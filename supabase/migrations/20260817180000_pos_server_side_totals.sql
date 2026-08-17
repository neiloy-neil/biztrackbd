-- =============================================================
-- Migration: POS Server-Side Total Recalculation (P0-C)
--
-- Previously, process_pos_sale trusted p_total_amount, p_subtotal,
-- and per-item unit_price/subtotal from the client. A malicious
-- client could pass price=0.01 for a ৳1000 product.
--
-- Fix: The RPC now:
--   1. Looks up each product's price directly from the products table
--   2. Validates each product belongs to the correct business
--   3. Computes subtotal = SUM(quantity × db_price)
--   4. Caps discount to [0, computed_subtotal]
--   5. Computes total = subtotal − capped_discount
--   6. Uses server-computed values for the transaction insert
--
-- Parameters removed: p_total_amount, p_subtotal
-- Client now sends: product_id + quantity only (unit_price ignored)
-- =============================================================

CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_party_id     UUID,
  p_discount     NUMERIC,
  p_notes        TEXT,
  p_user_id      UUID,
  p_items        JSONB,
  p_payments     JSONB
) RETURNS UUID AS $$
DECLARE
  v_transaction_id    UUID;
  v_item              RECORD;
  v_payment           RECORD;
  v_product_price     NUMERIC;
  v_product_bid       UUID;
  v_item_subtotal     NUMERIC;
  v_computed_subtotal NUMERIC := 0;
  v_actual_discount   NUMERIC;
  v_computed_total    NUMERIC;
BEGIN
  -- ── 1. Validate inputs ───────────────────────────────────────
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- ── 2. Compute subtotal from DB prices ───────────────────────
  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC)
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity % for product %', v_item.quantity, v_item.product_id;
    END IF;

    SELECT price, business_id
      INTO v_product_price, v_product_bid
      FROM public.products
     WHERE id = v_item.product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item.product_id;
    END IF;

    IF v_product_bid != p_business_id THEN
      RAISE EXCEPTION 'Product % does not belong to this business', v_item.product_id;
    END IF;

    v_computed_subtotal := v_computed_subtotal + (v_item.quantity * v_product_price);
  END LOOP;

  -- ── 3. Cap discount; compute server-authoritative total ──────
  v_actual_discount := GREATEST(0, LEAST(COALESCE(p_discount, 0), v_computed_subtotal));
  v_computed_total  := v_computed_subtotal - v_actual_discount;

  -- ── 4. Insert transaction using server-computed totals ───────
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    v_computed_total, v_computed_subtotal, v_actual_discount,
    p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- ── 5. Insert items + inventory movements with DB prices ─────
  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC)
  LOOP
    SELECT price INTO v_product_price
      FROM public.products
     WHERE id = v_item.product_id;

    v_item_subtotal := v_item.quantity * v_product_price;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity,
      v_product_price, v_item_subtotal
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id,
      'out', v_item.quantity, p_user_id
    );
  END LOOP;

  -- ── 6. Record payments (validate account ownership) ──────────
  FOR v_payment IN
    SELECT *
    FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
