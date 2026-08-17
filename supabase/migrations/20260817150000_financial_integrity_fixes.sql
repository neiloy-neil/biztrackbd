-- =============================================================
-- Migration: Financial Integrity Fixes
-- Fixes: P0-1, P0-2, P0-3, P1-1, P1-2, P1-4(DB), P1-6,
--        P2-1, P2-2, P2-6, P2-7, P3-3, P1-7(constraint)
-- =============================================================

-- ============================================================
-- P0-1: DROP the redundant `trg_maintain_product_stock` trigger.
-- `trg_set_inventory_movement_balances` (BEFORE INSERT, with
-- FOR UPDATE lock and negative-stock check) is the authoritative
-- stock trigger. The AFTER INSERT/DELETE trigger from the
-- performance-scaling migration caused every stock change to be
-- applied TWICE.
-- ============================================================
DROP TRIGGER IF EXISTS trg_maintain_product_stock ON public.inventory_movements;
DROP FUNCTION IF EXISTS public.maintain_product_stock();


-- ============================================================
-- P2-7: Prevent DELETE/UPDATE on inventory_movements.
-- Inventory movements are an immutable ledger. Deleting or
-- editing a movement would silently corrupt current_stock.
-- ============================================================
DROP POLICY IF EXISTS "Tenant isolation UPDATE inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Prevent delete inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Prevent update inventory_movements" ON public.inventory_movements;

CREATE POLICY "Prevent update inventory_movements"
  ON public.inventory_movements FOR UPDATE USING (false);

CREATE POLICY "Prevent delete inventory_movements"
  ON public.inventory_movements FOR DELETE USING (false);


-- ============================================================
-- P1-4 (DB): Fix transaction_date default to Asia/Dhaka.
-- The old default was current_date (UTC server time). Dhaka is
-- UTC+6, so transactions after 18:00 UTC would be misdated.
-- ============================================================
ALTER TABLE public.transactions
  ALTER COLUMN transaction_date
  SET DEFAULT (NOW() AT TIME ZONE 'Asia/Dhaka')::date;


-- ============================================================
-- P3-3: Make daily_closings immutable after creation.
-- Financial closing records must be append-only.
-- ============================================================
DROP POLICY IF EXISTS "Prevent update daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Prevent delete daily_closings" ON public.daily_closings;

CREATE POLICY "Prevent update daily_closings"
  ON public.daily_closings FOR UPDATE USING (false);

CREATE POLICY "Prevent delete daily_closings"
  ON public.daily_closings FOR DELETE USING (false);


-- ============================================================
-- P1-7: Prevent zero-quantity inventory movements.
-- ============================================================
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS chk_movement_quantity_nonzero;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT chk_movement_quantity_nonzero CHECK (quantity != 0);


-- ============================================================
-- P0-2 + P2-6: Rewrite maintain_party_balance trigger.
--
-- Fixes:
--   P0-2 — opening_balance transactions linked to a party now
--           correctly update current_due, matching get_party_dues.
--   P2-6 — party_id reassignment on UPDATE reverses the old
--           party's balance and applies it to the new one.
--   Also — type='both' parties are now handled correctly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.maintain_party_balance()
RETURNS trigger AS $$
DECLARE
  v_party_type public.party_type;
BEGIN

  -- -------------------------------------------------------
  -- INSERT: New completed transaction linked to a party
  -- -------------------------------------------------------
  IF TG_OP = 'INSERT' AND NEW.state = 'completed' AND NEW.party_id IS NOT NULL THEN
    SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;

    IF v_party_type IN ('customer', 'both') THEN
      IF NEW.type IN ('sale', 'opening_balance') THEN
        UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      ELSIF NEW.type = 'payment_in' THEN
        UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      END IF;
    ELSIF v_party_type = 'supplier' THEN
      IF NEW.type IN ('purchase', 'opening_balance') THEN
        UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      ELSIF NEW.type = 'payment_out' THEN
        UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      END IF;
    END IF;
  END IF;

  -- -------------------------------------------------------
  -- UPDATE cases
  -- -------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN

    -- Case A: party_id was reassigned (P2-6 fix)
    IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN

      -- Reverse OLD party's balance
      IF OLD.party_id IS NOT NULL AND OLD.state = 'completed' THEN
        SELECT type INTO v_party_type FROM public.parties WHERE id = OLD.party_id;
        IF v_party_type IN ('customer', 'both') THEN
          IF OLD.type IN ('sale', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          ELSIF OLD.type = 'payment_in' THEN
            UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          END IF;
        ELSIF v_party_type = 'supplier' THEN
          IF OLD.type IN ('purchase', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          ELSIF OLD.type = 'payment_out' THEN
            UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          END IF;
        END IF;
      END IF;

      -- Apply to NEW party
      IF NEW.party_id IS NOT NULL AND NEW.state = 'completed' THEN
        SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
        IF v_party_type IN ('customer', 'both') THEN
          IF NEW.type IN ('sale', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          ELSIF NEW.type = 'payment_in' THEN
            UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          END IF;
        ELSIF v_party_type = 'supplier' THEN
          IF NEW.type IN ('purchase', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          ELSIF NEW.type = 'payment_out' THEN
            UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          END IF;
        END IF;
      END IF;

    END IF; -- end party_id reassignment

    -- Case B: State completed -> non-completed (reverse, same party)
    IF OLD.state = 'completed' AND NEW.state != 'completed'
       AND OLD.party_id IS NOT NULL
       AND OLD.party_id IS NOT DISTINCT FROM NEW.party_id
    THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = OLD.party_id;
      IF v_party_type IN ('customer', 'both') THEN
        IF OLD.type IN ('sale', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF OLD.type IN ('purchase', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      END IF;
    END IF;

    -- Case C: State non-completed -> completed (apply, same party)
    IF OLD.state != 'completed' AND NEW.state = 'completed'
       AND NEW.party_id IS NOT NULL
       AND OLD.party_id IS NOT DISTINCT FROM NEW.party_id
    THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
      IF v_party_type IN ('customer', 'both') THEN
        IF NEW.type IN ('sale', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF NEW.type IN ('purchase', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      END IF;
    END IF;

  END IF; -- end UPDATE

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_maintain_party_balance ON public.transactions;
CREATE TRIGGER trg_maintain_party_balance
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.maintain_party_balance();


-- ============================================================
-- P1-6: Trigger to maintain current_due when opening_balance
-- column is directly edited on the parties table.
-- Since opening_balance is a mutable column (not a ledger entry),
-- we must reflect changes in current_due immediately.
-- ============================================================
CREATE OR REPLACE FUNCTION public.maintain_party_balance_on_opening_change()
RETURNS trigger AS $$
DECLARE
  v_delta numeric(19,4);
BEGIN
  IF OLD.opening_balance IS NOT DISTINCT FROM NEW.opening_balance THEN
    RETURN NULL;
  END IF;
  v_delta := NEW.opening_balance - OLD.opening_balance;
  -- Update current_due by the delta. We avoid recursion because
  -- this trigger fires only on UPDATE OF opening_balance, and
  -- the inner UPDATE only modifies current_due (not opening_balance).
  UPDATE public.parties
  SET current_due = current_due + v_delta,
      updated_at  = now()
  WHERE id = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_party_opening_balance_change ON public.parties;
CREATE TRIGGER trg_party_opening_balance_change
  AFTER UPDATE OF opening_balance ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.maintain_party_balance_on_opening_change();


-- ============================================================
-- P0-3: Harden process_pos_sale.
-- Validates that each payment account belongs to the business
-- before inserting account_transactions. Any error will roll
-- back the entire PL/pgSQL function call atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_party_id     UUID,
  p_total_amount NUMERIC,
  p_subtotal     NUMERIC,
  p_discount     NUMERIC,
  p_notes        TEXT,
  p_user_id      UUID,
  p_items        JSONB,
  p_payments     JSONB
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item    RECORD;
  v_payment RECORD;
BEGIN
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      product_id UUID, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC
    )
  LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity,
      v_item.unit_price, v_item.subtotal
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id,
      'out', v_item.quantity, p_user_id
    );
  END LOOP;

  FOR v_payment IN
    SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC)
  LOOP
    IF v_payment.amount > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = v_payment.account_id
          AND business_id = p_business_id
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Invalid payment account: % does not belong to business %',
          v_payment.account_id, p_business_id;
      END IF;

      INSERT INTO public.account_transactions (transaction_id, account_id, amount)
      VALUES (v_transaction_id, v_payment.account_id, v_payment.amount);
    END IF;
  END LOOP;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- P1-1: create_transaction_atomic
-- Inserts transactions + account_transactions in ONE implicit
-- DB transaction. Any failure rolls back both inserts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_type         TEXT,
  p_total_amount NUMERIC,
  p_account_id   UUID,
  p_party_id     UUID    DEFAULT NULL,
  p_category     TEXT    DEFAULT NULL,
  p_notes        TEXT    DEFAULT NULL,
  p_attachments  TEXT[]  DEFAULT NULL,
  p_created_by   UUID    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_account_amount NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id
      AND business_id = p_business_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid account: % does not belong to this business', p_account_id;
  END IF;

  v_account_amount := CASE
    WHEN p_type IN ('sale', 'income', 'payment_in', 'opening_balance') THEN  p_total_amount
    WHEN p_type IN ('expense', 'purchase', 'payment_out')              THEN -p_total_amount
    ELSE p_total_amount
  END;

  INSERT INTO public.transactions (
    business_id, branch_id, type, state, total_amount,
    party_id, category, notes, attachments, created_by
  ) VALUES (
    p_business_id, p_branch_id,
    p_type::public.transaction_type,
    'completed',
    p_total_amount,
    p_party_id, p_category, p_notes,
    COALESCE(p_attachments, ARRAY[]::TEXT[]),
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.account_transactions (transaction_id, account_id, amount)
  VALUES (v_transaction_id, p_account_id, v_account_amount);

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- P1-2: create_product_atomic
-- Inserts product + initial inventory_movement atomically.
-- If the stock movement fails (e.g. branch not found), the
-- entire product creation is rolled back.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_product_atomic(
  p_business_id   UUID,
  p_name          TEXT,
  p_sku           TEXT    DEFAULT NULL,
  p_barcode       TEXT    DEFAULT NULL,
  p_category_id   UUID    DEFAULT NULL,
  p_price         NUMERIC DEFAULT 0,
  p_cost          NUMERIC DEFAULT 0,
  p_unit          TEXT    DEFAULT 'pcs',
  p_min_stock     NUMERIC DEFAULT 0,
  p_supplier_id   UUID    DEFAULT NULL,
  p_image_url     TEXT    DEFAULT NULL,
  p_initial_stock NUMERIC DEFAULT 0,
  p_created_by    UUID    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_product_id UUID;
  v_branch_id  UUID;
BEGIN
  INSERT INTO public.products (
    business_id, name, sku, barcode, category_id,
    price, cost, unit, min_stock, supplier_id, image_url
  ) VALUES (
    p_business_id, p_name, p_sku, p_barcode, p_category_id,
    p_price, p_cost, p_unit, p_min_stock, p_supplier_id, p_image_url
  ) RETURNING id INTO v_product_id;

  IF p_initial_stock > 0 THEN
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE business_id = p_business_id
    LIMIT 1;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'No branch found for business %', p_business_id;
    END IF;

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, type, quantity, reason, created_by
    ) VALUES (
      p_business_id, v_branch_id, v_product_id,
      'adjustment', p_initial_stock,
      'প্রারম্ভিক স্টক (Initial Stock)',
      p_created_by
    );
  END IF;

  RETURN v_product_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- P2-2 / P2-1: Fix get_financial_summary and get_party_dues.
-- Purchase is an asset acquisition, not an operating expense.
-- get_party_dues now reads the materialized current_due column
-- for speed and consistency with the trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_business_id UUID, p_start_date date, p_end_date date
) RETURNS TABLE (
  total_income  numeric,
  total_expense numeric,
  net_profit    numeric,
  cash_in       numeric,
  cash_out      numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH txn_stats AS (
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE type IN ('sale', 'income')), 0) AS inc,
      COALESCE(SUM(total_amount) FILTER (WHERE type = 'expense'),           0) AS exp
    FROM transactions
    WHERE business_id    = p_business_id
      AND state          = 'completed'
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date
  ),
  cash_stats AS (
    SELECT
      COALESCE(SUM(amount)      FILTER (WHERE amount > 0), 0) AS c_in,
      COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS c_out
    FROM account_transactions
    WHERE transaction_id IN (
      SELECT id FROM transactions
      WHERE business_id    = p_business_id
        AND state          = 'completed'
        AND transaction_date >= p_start_date
        AND transaction_date <= p_end_date
    )
  )
  SELECT inc, exp, (inc - exp), c_in, c_out
  FROM txn_stats, cash_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_party_dues(p_business_id uuid)
RETURNS TABLE (customer_dues jsonb, supplier_payables jsonb) AS $$
DECLARE
  v_customers jsonb;
  v_suppliers jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', id, 'name', name, 'phone', phone, 'balance', current_due)
      ORDER BY current_due DESC
    ), '[]'::jsonb
  ) INTO v_customers
  FROM public.parties
  WHERE business_id = p_business_id
    AND type IN ('customer', 'both')
    AND deleted_at IS NULL
    AND current_due > 0;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', id, 'name', name, 'phone', phone, 'balance', current_due)
      ORDER BY current_due DESC
    ), '[]'::jsonb
  ) INTO v_suppliers
  FROM public.parties
  WHERE business_id = p_business_id
    AND type IN ('supplier', 'both')
    AND deleted_at IS NULL
    AND current_due > 0;

  RETURN QUERY SELECT v_customers, v_suppliers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- P2-7: Fix get_inventory_analytics to use cached current_stock
-- (the materialized column) instead of recalculating from
-- inventory_movements. This ensures consistency with the
-- dashboard and POS which also read current_stock.
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_analytics(p_business_id uuid)
RETURNS TABLE (
  total_valuation      numeric,
  low_stock_items      jsonb,
  stock_valuation_list jsonb
) AS $$
DECLARE
  v_valuation numeric;
  v_low       jsonb;
  v_list      jsonb;
BEGIN
  SELECT COALESCE(SUM(current_stock * cost), 0) INTO v_valuation
  FROM public.products
  WHERE business_id = p_business_id
    AND deleted_at IS NULL
    AND current_stock > 0;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('name', name, 'stock', current_stock, 'min_stock', min_stock)
      ORDER BY current_stock ASC
    ), '[]'::jsonb
  ) INTO v_low
  FROM public.products
  WHERE business_id   = p_business_id
    AND deleted_at    IS NULL
    AND current_stock <= min_stock
  LIMIT 20;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name',  name,
        'stock', current_stock,
        'cost',  cost,
        'value', current_stock * cost
      ) ORDER BY (current_stock * cost) DESC
    ), '[]'::jsonb
  ) INTO v_list
  FROM public.products
  WHERE business_id  = p_business_id
    AND deleted_at   IS NULL
    AND current_stock > 0
  LIMIT 50;

  RETURN QUERY SELECT COALESCE(v_valuation, 0), v_low, v_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
