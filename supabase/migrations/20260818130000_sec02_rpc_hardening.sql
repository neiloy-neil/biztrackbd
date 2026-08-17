-- ============================================================
-- SEC-02 RPC Hardening (Cross-Tenant IDOR Remediation)
-- 
-- The following functions are SECURITY DEFINER and were missing
-- explicit `public.is_business_member()` checks, making them 
-- vulnerable to direct REST API calls acting across tenants.
-- ============================================================

-- 1. create_transaction_atomic
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
  -- [SECURITY PATCH] Validate caller is a member of this business
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access Denied: You are not a member of this business.';
  END IF;

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
  IF p_account_id IS NOT NULL THEN
    IF p_type IN ('sale', 'payment_in') THEN
      v_account_amount := p_total_amount;
    ELSE
      v_account_amount := -p_total_amount;
    END IF;

    INSERT INTO public.account_transactions (transaction_id, account_id, amount)
    VALUES (v_transaction_id, p_account_id, v_account_amount);
  END IF;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. create_transfer_atomic
CREATE OR REPLACE FUNCTION public.create_transfer_atomic(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_amount       NUMERIC,
  p_from_account_id UUID,
  p_to_account_id   UUID,
  p_notes        TEXT    DEFAULT NULL,
  p_created_by   UUID    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- [SECURITY PATCH] Validate caller is a member of this business
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access Denied: You are not a member of this business.';
  END IF;

  -- Validate amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Validate accounts exist and belong to business
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_from_account_id AND business_id = p_business_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid source account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_to_account_id AND business_id = p_business_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid destination account';
  END IF;

  -- 1. Create the Transaction
  INSERT INTO public.transactions (
    business_id, branch_id, type, state, total_amount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, 'transfer', 'completed', p_amount, p_notes, p_created_by
  ) RETURNING id INTO v_transaction_id;

  -- 2. Create the Source Account Deduction (Negative)
  INSERT INTO public.account_transactions (transaction_id, account_id, amount)
  VALUES (v_transaction_id, p_from_account_id, -p_amount);

  -- 3. Create the Destination Account Addition (Positive)
  INSERT INTO public.account_transactions (transaction_id, account_id, amount)
  VALUES (v_transaction_id, p_to_account_id, p_amount);

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. process_pos_sale
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
  -- [SECURITY PATCH] Validate caller is a member of this business
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access Denied: You are not a member of this business.';
  END IF;

  -- Insert the sale transaction
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- Process line items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC, total_price NUMERIC)
  LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, total_price
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.total_price
    );
  END LOOP;

  -- Process payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC)
  LOOP
    IF v_payment.amount > 0 THEN
      IF p_party_id IS NOT NULL THEN
        INSERT INTO public.transactions (
          business_id, branch_id, party_id, type, state,
          total_amount, notes, created_by, reference_id
        ) VALUES (
          p_business_id, p_branch_id, p_party_id, 'payment_in', 'completed',
          v_payment.amount, 'POS Payment for Sale', p_user_id, v_transaction_id
        ) RETURNING id INTO v_payment_txn_id;

        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_payment_txn_id, v_payment.account_id, v_payment.amount);
      ELSE
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


-- 4. reverse_transaction_atomic
CREATE OR REPLACE FUNCTION public.reverse_transaction_atomic(
  p_transaction_id uuid,
  p_user_id uuid,
  p_reason text
) RETURNS boolean AS $$
DECLARE
  v_transaction record;
  v_inv_movement record;
  v_acc_transaction record;
  v_reverse_type public.inventory_movement_type;
BEGIN
  -- 1. Lock the transaction to prevent race conditions
  SELECT * INTO v_transaction 
  FROM public.transactions 
  WHERE id = p_transaction_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- [SECURITY PATCH] Validate caller is a member of the business that owns this transaction
  IF NOT public.is_business_member(v_transaction.business_id) THEN
    RAISE EXCEPTION 'Access Denied: You cannot reverse a transaction in another business.';
  END IF;

  -- 2. Verify state is 'completed'
  IF v_transaction.state != 'completed' THEN
    RAISE EXCEPTION 'Only completed transactions can be reversed. Current state: %', v_transaction.state;
  END IF;

  -- 3. Mark the original transaction as voided
  UPDATE public.transactions 
  SET 
    state = 'voided', 
    notes = COALESCE(notes, '') || E'\n[Voided on ' || now()::date || ': ' || p_reason || ']'
  WHERE id = p_transaction_id;

  -- 4. Reverse Inventory Movements
  FOR v_inv_movement IN 
    SELECT * FROM public.inventory_movements WHERE transaction_id = p_transaction_id
  LOOP
    -- Determine the exact opposite movement type
    IF v_inv_movement.movement_type = 'sale' THEN
      v_reverse_type := 'return_in';
    ELSIF v_inv_movement.movement_type = 'purchase' THEN
      v_reverse_type := 'return_out';
    ELSIF v_inv_movement.movement_type = 'return_in' THEN
      v_reverse_type := 'sale';
    ELSIF v_inv_movement.movement_type = 'return_out' THEN
      v_reverse_type := 'purchase';
    ELSIF v_inv_movement.movement_type = 'adjustment_up' THEN
      v_reverse_type := 'adjustment_down';
    ELSIF v_inv_movement.movement_type = 'adjustment_down' THEN
      v_reverse_type := 'adjustment_up';
    ELSE
      -- Fallback for unhandled types
      RAISE EXCEPTION 'Cannot automatically reverse movement type: %', v_inv_movement.movement_type;
    END IF;

    -- Write the counter-movement
    INSERT INTO public.inventory_movements (
      business_id,
      product_id,
      transaction_id,
      movement_type,
      quantity,
      unit_cost,
      notes,
      created_by
    ) VALUES (
      v_inv_movement.business_id,
      v_inv_movement.product_id,
      p_transaction_id, -- Link to the same transaction for auditing
      v_reverse_type,
      v_inv_movement.quantity, -- Trigger handles +/- based on type
      v_inv_movement.unit_cost,
      'Reversal of movement ' || v_inv_movement.id,
      p_user_id
    );
  END LOOP;

  -- 5. Reverse Account Transactions
  FOR v_acc_transaction IN
    SELECT * FROM public.account_transactions WHERE transaction_id = p_transaction_id
  LOOP
    -- To reverse an account transaction, we create a new negative of the original amount.
    -- If it was a debit (positive), this writes a credit (negative).
    -- If it was a credit (negative), this writes a debit (positive).
    INSERT INTO public.account_transactions (
      transaction_id,
      account_id,
      amount
    ) VALUES (
      p_transaction_id,
      v_acc_transaction.account_id,
      -v_acc_transaction.amount
    );
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
