-- ── POS Workflow Bug Fix: Restore explicit current_due tracking ──
-- During a previous security hardening sprint, the process_pos_sale RPC
-- was overwritten and lost the critical logic that updates a customer's
-- current_due when making a credit or partial payment sale via POS.
-- This migration restores that logic.

CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id UUID,
  p_branch_id UUID,
  p_party_id UUID, 
  p_total_amount NUMERIC, -- Kept for interface compatibility, but ignored
  p_subtotal NUMERIC,     -- Kept for interface compatibility, but ignored
  p_discount NUMERIC,
  p_notes TEXT,
  p_user_id UUID,
  p_items JSONB, 
  p_payments JSONB 
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item RECORD;
  v_payment RECORD;
  v_calc_subtotal NUMERIC := 0;
  v_calc_total NUMERIC := 0;
  v_db_price NUMERIC;
  v_total_paid NUMERIC := 0;
  v_due_delta NUMERIC := 0;
BEGIN
  IF p_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  -- 1. Server-side price calculation
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC) LOOP
    SELECT price INTO v_db_price FROM public.products 
    WHERE id = v_item.product_id AND business_id = p_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or does not belong to business', v_item.product_id;
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_db_price * v_item.quantity);
  END LOOP;

  v_calc_total := v_calc_subtotal - p_discount;

  -- 2. Insert transaction using calculated totals
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, 
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    v_calc_total, v_calc_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- 3. Process items using database prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC) LOOP
    SELECT price INTO v_db_price FROM public.products WHERE id = v_item.product_id;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_db_price, (v_db_price * v_item.quantity)
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id, 'out', v_item.quantity, p_user_id
    );
  END LOOP;

  -- 4. Process payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC) LOOP
    IF v_payment.amount > 0 THEN
      INSERT INTO public.account_transactions (
        transaction_id, account_id, amount
      ) VALUES (
        v_transaction_id, v_payment.account_id, v_payment.amount
      );
      v_total_paid := v_total_paid + v_payment.amount;
    END IF;
  END LOOP;

  -- 5. Calculate and update current_due if there's a party
  IF p_party_id IS NOT NULL THEN
    v_due_delta := v_calc_total - v_total_paid;
    
    -- In POS, sales always increase the customer's due (receivable)
    IF v_due_delta > 0 THEN
      UPDATE public.parties 
      SET 
        current_due = current_due + v_due_delta, 
        updated_at = now() 
      WHERE id = p_party_id;
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
