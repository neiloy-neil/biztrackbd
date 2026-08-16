-- Migration: Dashboard Performance Indexes and Aggregation RPC

-- 1. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date_biz ON public.transactions(business_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type_biz ON public.transactions(business_id, type, transaction_date);
CREATE INDEX IF NOT EXISTS idx_parties_type_biz ON public.parties(business_id, type);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory_movements(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_acc_txn_acc ON public.account_transactions(account_id);

-- 2. Dashboard Metrics RPC
-- Returns a single JSON object with all critical top-level metrics to prevent N+1 queries.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS json AS $$
DECLARE
  v_total_sales numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_available_money numeric(19,4) := 0;
  v_customer_due numeric(19,4) := 0;
  v_supplier_payable numeric(19,4) := 0;
BEGIN
  -- Verify ownership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Sales within range
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'sale'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Expenses within range
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Total Available Money (Cash/Bank) - Sum of all account_transactions for this business
  SELECT COALESCE(SUM(at.amount), 0) INTO v_available_money
  FROM public.account_transactions at
  JOIN public.accounts a ON at.account_id = a.id
  WHERE a.business_id = p_business_id;

  -- Total Customer Due (Assume we track total due by iterating parties or transactions)
  -- For now, let's assume we sum unresolved sale vs payments, or we have a cached balance on parties.
  -- The previous schema had `parties.current_balance`, but in the DDD schema we dropped it to make it immutable.
  -- We must calculate balance from transactions: Sale amount - Payment in amount.
  -- Since calculating full party balances on the fly is heavy, we'll do a quick aggregation of all customer transactions:
  SELECT COALESCE(
    SUM(CASE WHEN type = 'sale' THEN total_amount WHEN type = 'payment_in' THEN -total_amount ELSE 0 END)
  , 0) INTO v_customer_due
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND party_id IN (SELECT id FROM public.parties WHERE business_id = p_business_id AND type IN ('customer', 'both'));

  -- Total Supplier Payable
  SELECT COALESCE(
    SUM(CASE WHEN type = 'purchase' THEN total_amount WHEN type = 'payment_out' THEN -total_amount ELSE 0 END)
  , 0) INTO v_supplier_payable
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND party_id IN (SELECT id FROM public.parties WHERE business_id = p_business_id AND type IN ('supplier', 'both'));

  -- Return JSON
  RETURN json_build_object(
    'total_sales', v_total_sales,
    'total_expenses', v_total_expenses,
    'estimated_profit', v_total_sales - v_total_expenses, -- Simplified gross profit for now
    'available_money', v_available_money,
    'customer_due', v_customer_due,
    'supplier_payable', v_supplier_payable
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
