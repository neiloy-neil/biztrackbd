-- Migration: Sales Returns Engine
-- Adds necessary columns and RPC for partial/full sales returns.

-- 1. Schema Additions
ALTER TABLE public.transactions
  ADD COLUMN parent_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.transaction_items
  ADD COLUMN returned_quantity numeric(19,4) DEFAULT 0 NOT NULL;

-- 2. New RPC: process_sale_return_atomic
-- Processes a return ensuring integrity across inventory, finance, and party ledgers.
CREATE OR REPLACE FUNCTION public.process_sale_return_atomic(
  p_business_id UUID,
  p_branch_id UUID,
  p_parent_transaction_id UUID,
  p_items JSONB, -- Array of { id: transaction_item_id, return_qty: number }
  p_payments JSONB, -- Array of { account_id, amount } (refunds out)
  p_reason TEXT,
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_parent_tx RECORD;
  v_item RECORD;
  v_payment RECORD;
  v_return_tx_id UUID;
  v_return_subtotal NUMERIC(19,4) := 0;
  v_total_refund_paid NUMERIC(19,4) := 0;
  v_due_delta NUMERIC(19,4) := 0;
  v_parent_item RECORD;
BEGIN
  -- 1. Validate Parent Transaction
  SELECT * INTO v_parent_tx FROM public.transactions 
  WHERE id = p_parent_transaction_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original transaction not found or access denied.';
  END IF;

  IF v_parent_tx.type != 'sale' THEN
    RAISE EXCEPTION 'Only sales can be returned using this function.';
  END IF;

  IF v_parent_tx.state != 'completed' THEN
    RAISE EXCEPTION 'Cannot return a transaction that is not completed.';
  END IF;

  -- 2. Create the Return Transaction Header (amount will be updated later)
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by, parent_id
  ) VALUES (
    p_business_id, p_branch_id, v_parent_tx.party_id, 'sale_return', 'completed',
    0, 0, 0, p_reason, p_created_by, p_parent_transaction_id
  ) RETURNING id INTO v_return_tx_id;

  -- 3. Process Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, return_qty NUMERIC) LOOP
    IF v_item.return_qty <= 0 THEN
      CONTINUE; -- Skip zeros
    END IF;

    -- Fetch original item
    SELECT * INTO v_parent_item FROM public.transaction_items 
    WHERE id = v_item.id AND transaction_id = p_parent_transaction_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction item not found.';
    END IF;

    -- Validate quantity bounds
    IF (v_parent_item.returned_quantity + v_item.return_qty) > v_parent_item.quantity THEN
      RAISE EXCEPTION 'Cannot return more than the sold quantity.';
    END IF;

    -- Update returned quantity on parent
    UPDATE public.transaction_items
    SET returned_quantity = returned_quantity + v_item.return_qty
    WHERE id = v_parent_item.id;

    -- Calculate item return value (no discount proportioning per the plan)
    v_return_subtotal := v_return_subtotal + (v_parent_item.unit_price * v_item.return_qty);

    -- Insert Return Transaction Item
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_return_tx_id, v_parent_item.product_id, v_item.return_qty, v_parent_item.unit_price, (v_parent_item.unit_price * v_item.return_qty)
    );

    -- Reverse Inventory Movement (Restock)
    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_parent_item.product_id, v_return_tx_id, 'in', v_item.return_qty, p_created_by
    );
  END LOOP;

  -- 4. Process Payment Refunds
  IF p_payments IS NOT NULL THEN
    FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC) LOOP
      IF v_payment.amount > 0 THEN
        -- Refund means money leaves the account
        INSERT INTO public.account_transactions (
          transaction_id, account_id, amount
        ) VALUES (
          v_return_tx_id, v_payment.account_id, -v_payment.amount
        );
        v_total_refund_paid := v_total_refund_paid + v_payment.amount;
      END IF;
    END LOOP;
  END IF;

  -- 5. Finalize Return Transaction Totals
  UPDATE public.transactions
  SET total_amount = v_return_subtotal, subtotal = v_return_subtotal
  WHERE id = v_return_tx_id;

  -- 6. Adjust Party Current Due
  -- Customer due DECREASES by the value of goods returned (v_return_subtotal).
  -- Customer due INCREASES by any physical cash we handed back to them (v_total_refund_paid).
  IF v_parent_tx.party_id IS NOT NULL THEN
    v_due_delta := v_total_refund_paid - v_return_subtotal;
    
    IF v_due_delta != 0 THEN
      UPDATE public.parties 
      SET 
        current_due = current_due + v_due_delta, 
        updated_at = now() 
      WHERE id = v_parent_tx.party_id;
    END IF;
  END IF;

  RETURN v_return_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
