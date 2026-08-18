-- =============================================================
-- Migration: Inventory Reversal Engine
-- Provides immutable transaction reversal (voiding) by writing
-- explicit counter-movements to inventory and account ledgers.
-- =============================================================

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

  -- 2. Verify state is 'completed'
  IF v_transaction.state != 'completed' THEN
    RAISE EXCEPTION 'Only completed transactions can be reversed. Current state: %', v_transaction.state;
  END IF;

  -- 3. Update the state to 'reversed'
  -- By appending to the notes, we maintain a history of the void reason.
  UPDATE public.transactions
  SET 
    state = 'reversed',
    notes = COALESCE(notes, '') || E'\n\n[VOIDED]: ' || p_reason
  WHERE id = p_transaction_id;

  -- 4. Reverse Inventory Movements
  -- For every existing movement linked to this transaction, we create a counter-movement.
  FOR v_inv_movement IN (
    SELECT * FROM public.inventory_movements WHERE transaction_id = p_transaction_id
  ) LOOP
    IF v_inv_movement.type = 'in' THEN
      v_reverse_type := 'out';
    ELSIF v_inv_movement.type = 'out' THEN
      v_reverse_type := 'in';
    ELSE
      -- for adjustments, we can just use the same type and negate the quantity
      v_reverse_type := 'adjustment';
    END IF;

    INSERT INTO public.inventory_movements (
      business_id, 
      branch_id, 
      product_id, 
      transaction_id, 
      type, 
      quantity, 
      reason, 
      created_by
    ) VALUES (
      v_inv_movement.business_id,
      v_inv_movement.branch_id,
      v_inv_movement.product_id,
      p_transaction_id,
      v_reverse_type,
      CASE WHEN v_reverse_type = 'adjustment' THEN -v_inv_movement.quantity ELSE v_inv_movement.quantity END,
      'Transaction Reversal: ' || p_reason,
      p_user_id
    );
  END LOOP;

  -- 5. Reverse Financial (Account) Transactions
  -- For every existing account transaction linked to this transaction, we insert a negated amount.
  FOR v_acc_transaction IN (
    SELECT * FROM public.account_transactions WHERE transaction_id = p_transaction_id
  ) LOOP
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
