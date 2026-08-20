-- 1. Create RPC for COD Reconciliation
CREATE OR REPLACE FUNCTION public.reconcile_cod_payout(
  p_order_id uuid,
  p_account_id uuid,
  p_payout_amount numeric,
  p_courier_charge numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_shipment_id uuid;
  v_party_id uuid;
  v_business_id uuid;
  v_branch_id uuid;
  v_payout_trx_id uuid;
  v_expense_trx_id uuid;
BEGIN
  -- Validate
  IF p_payout_amount < 0 OR p_courier_charge < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  -- Get Order
  SELECT * INTO v_order FROM public.transactions WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF (p_payout_amount + p_courier_charge) <> v_order.total_amount THEN
    RAISE EXCEPTION 'Payout + Courier Charge (%) must equal Total Order Amount (%)', (p_payout_amount + p_courier_charge), v_order.total_amount;
  END IF;

  v_party_id := v_order.party_id;
  v_business_id := v_order.business_id;
  v_branch_id := v_order.branch_id;

  -- 1. Decrease Party Due by total amount
  IF v_party_id IS NOT NULL THEN
    UPDATE public.parties 
    SET current_due = current_due - v_order.total_amount,
        updated_at = now()
    WHERE id = v_party_id;
  END IF;

  -- 2. Create Payment In Transaction (Income to Bank)
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, total_amount, reference, notes
  ) VALUES (
    v_business_id, v_branch_id, v_party_id, 'payment_in', 'completed', p_payout_amount, 'COD-' || p_order_id, 'Courier COD Payout'
  ) RETURNING id INTO v_payout_trx_id;

  INSERT INTO public.account_transactions (
    transaction_id, account_id, amount
  ) VALUES (
    v_payout_trx_id, p_account_id, p_payout_amount
  );

  -- 3. Create Expense Transaction for Courier Fee (if any)
  IF p_courier_charge > 0 THEN
    INSERT INTO public.transactions (
      business_id, branch_id, party_id, type, state, total_amount, reference, notes
    ) VALUES (
      v_business_id, v_branch_id, v_party_id, 'expense', 'completed', p_courier_charge, 'COD-FEE-' || p_order_id, 'Courier Delivery Fee'
    ) RETURNING id INTO v_expense_trx_id;
    
    -- Courier fee doesn't necessarily leave the account now, it was deducted before payout,
    -- but to balance the books, we might need to deduct it from the cash account or we just record it as an expense without hitting an account,
    -- or we debit the account by the full amount and credit the fee. 
    -- Since we only debited the account by p_payout_amount, the books balance if we assume the expense is recorded without a cash outflow here, 
    -- or we can just leave it as an expense transaction to track the P&L hit.
    -- To keep it simple, we don't insert into account_transactions for the fee since the money never entered our account.
  END IF;

  -- 4. Update Order and Shipment
  UPDATE public.transactions SET state = 'delivered', updated_at = now() WHERE id = p_order_id;
  UPDATE public.shipments SET status = 'delivered', updated_at = now() WHERE transaction_id = p_order_id;

  RETURN true;
END;
$$;
