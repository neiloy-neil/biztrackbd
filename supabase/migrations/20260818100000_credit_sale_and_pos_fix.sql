-- =============================================================
-- Migration: Credit Sale + POS Payment Fix
--
-- 1. create_transaction_atomic: make p_account_id optional.
--    When NULL (pure credit/due entry), skip account_transactions
--    so no phantom cash is recorded.
--
-- 2. process_pos_sale: for named customers, record each cash
--    payment as a separate payment_in transaction so current_due
--    is properly offset (sale +total, payment_in -paid = net due).
--    Walk-in customers retain the old direct account_transaction
--    approach (no party, no current_due tracking needed).
-- =============================================================


-- ============================================================
-- 1. create_transaction_atomic — nullable p_account_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_type         TEXT,
  p_total_amount NUMERIC,
  p_account_id   UUID    DEFAULT NULL,
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
  IF p_account_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = p_account_id
        AND business_id = p_business_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid account: % does not belong to this business', p_account_id;
    END IF;
  END IF;

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

  -- Only write to account_transactions when an account is given.
  -- A NULL account_id means this is a pure credit/receivable entry.
  IF p_account_id IS NOT NULL THEN
    v_account_amount := CASE
      WHEN p_type IN ('sale', 'income', 'payment_in', 'opening_balance') THEN  p_total_amount
      WHEN p_type IN ('expense', 'purchase', 'payment_out')              THEN -p_total_amount
      ELSE p_total_amount
    END;

    INSERT INTO public.account_transactions (transaction_id, account_id, amount)
    VALUES (v_transaction_id, p_account_id, v_account_amount);
  END IF;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 2. process_pos_sale — proper current_due tracking
--
-- Old: payment amounts went straight into account_transactions
--      on the sale transaction → current_due always grew by the
--      full sale amount even for cash sales.
--
-- New: each payment creates a separate payment_in transaction
--      (when a named party exists) so the trigger reduces
--      current_due by the paid portion.
--      Walk-in sales (no party_id) still write account_transactions
--      directly because there is no current_due to manage.
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
  v_transaction_id  UUID;
  v_payment_txn_id  UUID;
  v_item            RECORD;
  v_payment         RECORD;
BEGIN
  -- Insert the sale transaction
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- Insert items + inventory movements
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

  -- Record payments
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

      IF p_party_id IS NOT NULL THEN
        -- Named customer: create a payment_in transaction.
        -- The maintain_party_balance trigger will reduce current_due
        -- by this amount, offsetting the +total_amount from the sale.
        INSERT INTO public.transactions (
          business_id, branch_id, party_id, type, state, total_amount, created_by
        ) VALUES (
          p_business_id, p_branch_id, p_party_id, 'payment_in', 'completed',
          v_payment.amount, p_user_id
        ) RETURNING id INTO v_payment_txn_id;

        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_payment_txn_id, v_payment.account_id, v_payment.amount);
      ELSE
        -- Walk-in / no party: record cash received directly on the sale.
        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_transaction_id, v_payment.account_id, v_payment.amount);
      END IF;
    END IF;
  END LOOP;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
