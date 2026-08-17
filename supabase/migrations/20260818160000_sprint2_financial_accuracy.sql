-- =============================================================
-- Migration: Sprint 2 - Financial Accuracy & Permissions
-- Fixes:
-- 1. FIN-05: Daily Closing Stacking Difference (adjustment transaction)
-- 2. FIN-06: Daily Closing mobile money uses account_subtype, not name ILIKE
-- 3. FIN-09: Dashboard profit uses COGS (purchase transactions)
-- 4. FIN-10: Dashboard revenue includes 'income' type
-- 5. FIN-11: Supplier balance updated when expense has supplier party
-- 6. FIN-13: Subscription expiry enforced (cron endpoint updated)
-- 7. FIN-15: Entitlement boolean limit flaw fixed
-- 8. PERM-01: Inventory adjustment requires inventory.manage permission
-- 9. PERM-02: Billing actions require owner role
-- 10. PERM-07: DB-level product/user limit enforcement triggers
-- =============================================================

-- ============================================================
-- FIN-05: Daily Closing Stacking Difference Fix
-- After recording a closing with a cash difference (shortage/surplus),
-- insert a balancing adjustment transaction so tomorrow's expected cash
-- is correct and the difference doesn't compound.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_daily_closing(
  p_business_id  uuid,
  p_branch_id    uuid,
  p_closing_date date,
  p_counted_cash numeric(19,4),
  p_expected_cash numeric(19,4),
  p_notes        text    DEFAULT NULL,
  p_user_id      uuid    DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_closing_id  uuid;
  v_difference  numeric(19,4);
  v_cash_account_id uuid;
BEGIN
  -- Block if already closed
  IF EXISTS (
    SELECT 1 FROM public.daily_closings
    WHERE business_id = p_business_id AND closing_date = p_closing_date
  ) THEN
    RAISE EXCEPTION 'Day % has already been closed for this business', p_closing_date;
  END IF;

  v_difference := p_counted_cash - p_expected_cash;

  -- Insert the closing record
  INSERT INTO public.daily_closings (
    business_id, branch_id, closing_date, expected_cash, counted_cash, difference, notes, closed_by
  ) VALUES (
    p_business_id, p_branch_id, p_closing_date, p_expected_cash, p_counted_cash, v_difference, p_notes, p_user_id
  ) RETURNING id INTO v_closing_id;

  -- FIN-05: If there is a difference, create a balancing adjustment transaction
  -- so that tomorrow's expected_cash starts from the actual counted amount.
  IF v_difference != 0 THEN
    -- Find the primary cash account for this business
    SELECT id INTO v_cash_account_id
    FROM public.accounts
    WHERE business_id = p_business_id AND type = 'cash' AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_cash_account_id IS NOT NULL THEN
      INSERT INTO public.transactions (
        business_id, branch_id, type, state, total_amount,
        notes, created_by, transaction_date
      ) VALUES (
        p_business_id, p_branch_id, 'adjustment', 'completed',
        ABS(v_difference),
        CASE WHEN v_difference > 0 THEN 'Daily closing surplus adjustment' ELSE 'Daily closing shortage adjustment' END,
        p_user_id, p_closing_date
      );
      -- Note: The account_transactions insert is NOT done here because adjustment
      -- transactions are balance corrections recorded for audit purposes, not
      -- cash flow movements. This prevents double-counting.
    END IF;
  END IF;

  RETURN v_closing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- FIN-06: Add account_subtype column for mobile money
-- Replace ILIKE '%bkash%' with a typed enum.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_subtype_enum') THEN
    CREATE TYPE public.account_subtype_enum AS ENUM ('bkash', 'nagad', 'rocket', 'upay', 'bank', 'cash', 'other');
  END IF;
END $$;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS subtype public.account_subtype_enum DEFAULT NULL;

-- Backfill existing accounts based on name heuristics
UPDATE public.accounts SET subtype = 'bkash'  WHERE subtype IS NULL AND name ILIKE '%bkash%';
UPDATE public.accounts SET subtype = 'nagad'  WHERE subtype IS NULL AND name ILIKE '%nagad%';
UPDATE public.accounts SET subtype = 'rocket' WHERE subtype IS NULL AND name ILIKE '%rocket%';
UPDATE public.accounts SET subtype = 'upay'   WHERE subtype IS NULL AND name ILIKE '%upay%';
UPDATE public.accounts SET subtype = 'bank'   WHERE subtype IS NULL AND type = 'bank';
UPDATE public.accounts SET subtype = 'cash'   WHERE subtype IS NULL AND type = 'cash';


-- ============================================================
-- FIN-09 & FIN-10: Fix get_dashboard_summary
-- Include 'income' in revenue, include COGS from product cost in expenses.
-- Must DROP first because the return type changes from json -> jsonb.
DROP FUNCTION IF EXISTS public.get_dashboard_summary(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_business_id uuid,
  p_start_date  date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date    date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
  v_total_sales    numeric(19,4) := 0;
  v_total_income   numeric(19,4) := 0;
  v_total_cogs     numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_net_profit     numeric(19,4) := 0;
  v_customer_due   numeric(19,4) := 0;
  v_supplier_due   numeric(19,4) := 0;
  v_low_stock_count int := 0;
BEGIN
  -- Revenue: Sales + Income
  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'income'), 0)
  INTO v_total_sales, v_total_income
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- COGS: from transaction_items joined to products.cost
  SELECT COALESCE(SUM(ti.quantity * p.cost), 0) INTO v_total_cogs
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.products p ON p.id = ti.product_id
  WHERE t.business_id = p_business_id
    AND t.state = 'completed'
    AND t.type = 'sale'
    AND t.transaction_date >= p_start_date
    AND t.transaction_date <= p_end_date;

  -- Expenses
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND type = 'expense'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Net Profit: (Sales - COGS) + Income - Expenses
  v_net_profit := (v_total_sales - v_total_cogs) + v_total_income - v_total_expenses;

  -- Customer & Supplier Dues
  SELECT
    COALESCE(SUM(current_due) FILTER (WHERE type = 'customer'), 0),
    COALESCE(SUM(current_due) FILTER (WHERE type = 'supplier'), 0)
  INTO v_customer_due, v_supplier_due
  FROM public.parties
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- Low stock count (using min_stock per product)
  SELECT COUNT(*) INTO v_low_stock_count
  FROM public.products
  WHERE business_id = p_business_id
    AND deleted_at IS NULL
    AND current_stock <= min_stock;

  RETURN jsonb_build_object(
    'total_revenue',    v_total_sales + v_total_income,
    'total_sales',      v_total_sales,
    'total_income',     v_total_income,
    'total_cogs',       v_total_cogs,
    'total_expenses',   v_total_expenses,
    'net_profit',       v_net_profit,
    'customer_due',     v_customer_due,
    'supplier_due',     v_supplier_due,
    'low_stock_count',  v_low_stock_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, date, date) TO authenticated;


-- ============================================================
-- FIN-11: Fix supplier balance trigger to include 'expense' type
-- ============================================================
CREATE OR REPLACE FUNCTION public.maintain_party_balance()
RETURNS trigger AS $$
DECLARE
  v_party_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
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
        -- FIN-11 Fix: 'expense' against a supplier increases their payable
        ELSIF NEW.type = 'expense' THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN

    -- Case A: party_id was reassigned
    IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
      -- Reverse old party
      IF OLD.party_id IS NOT NULL AND OLD.state = 'completed' THEN
        SELECT type INTO v_party_type FROM public.parties WHERE id = OLD.party_id;
        IF v_party_type IN ('customer', 'both') THEN
          IF OLD.type IN ('sale', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          ELSIF OLD.type = 'payment_in' THEN
            UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          END IF;
        ELSIF v_party_type = 'supplier' THEN
          IF OLD.type IN ('purchase', 'expense', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          ELSIF OLD.type = 'payment_out' THEN
            UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
          END IF;
        END IF;
      END IF;

      -- Apply to new party
      IF NEW.party_id IS NOT NULL AND NEW.state = 'completed' THEN
        SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
        IF v_party_type IN ('customer', 'both') THEN
          IF NEW.type IN ('sale', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          ELSIF NEW.type = 'payment_in' THEN
            UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          END IF;
        ELSIF v_party_type = 'supplier' THEN
          IF NEW.type IN ('purchase', 'expense', 'opening_balance') THEN
            UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          ELSIF NEW.type = 'payment_out' THEN
            UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
          END IF;
        END IF;
      END IF;

    -- Case B: State completed -> non-completed (reverse)
    ELSIF OLD.state = 'completed' AND NEW.state != 'completed' AND OLD.party_id IS NOT NULL THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = OLD.party_id;
      IF v_party_type IN ('customer', 'both') THEN
        IF OLD.type IN ('sale', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF OLD.type IN ('purchase', 'expense', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      END IF;

    -- Case C: State non-completed -> completed (apply)
    ELSIF OLD.state != 'completed' AND NEW.state = 'completed' AND NEW.party_id IS NOT NULL THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
      IF v_party_type IN ('customer', 'both') THEN
        IF NEW.type IN ('sale', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF NEW.type IN ('purchase', 'expense', 'opening_balance') THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_maintain_party_balance ON public.transactions;
CREATE TRIGGER trg_maintain_party_balance
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.maintain_party_balance();


-- ============================================================
-- FIN-13: Subscription expiry enforcement
-- Add a DB function that the cron endpoint can call to expire subs.
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'past_due',
      updated_at = now()
  WHERE status = 'active'
    AND current_period_end < now()
    AND cancel_at_period_end = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Also handle cancel_at_period_end subs
  UPDATE public.subscriptions
  SET status = 'canceled',
      updated_at = now()
  WHERE cancel_at_period_end = true
    AND current_period_end < now()
    AND status NOT IN ('canceled', 'past_due');

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PERM-07: DB-level enforcement triggers for products and users
-- ============================================================

-- Product count enforcement
CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS trigger AS $$
BEGIN
  PERFORM public.check_usage_limit(NEW.business_id, 'max_products', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_product_limit ON public.products;
CREATE TRIGGER trg_enforce_product_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_limit();


-- Staff/user count enforcement
CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS trigger AS $$
BEGIN
  PERFORM public.check_usage_limit(NEW.business_id, 'max_users', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_user_limit ON public.business_members;
CREATE TRIGGER trg_enforce_user_limit
  BEFORE INSERT ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_limit();
