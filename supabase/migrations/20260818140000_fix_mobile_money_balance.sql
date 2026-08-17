-- Fix get_daily_closing_summary: replace ILIKE name matching with type-based lookup.
-- Previous code used a.name ILIKE '%bkash%' / '%nagad%' which breaks when accounts
-- are renamed. The accounts table has a type column; mobile_money covers all MFS accounts.

CREATE OR REPLACE FUNCTION public.get_daily_closing_summary(
  p_business_id uuid,
  p_date date
)
RETURNS jsonb AS $$
DECLARE
  v_expected_cash   numeric(19,4) := 0;

  v_cash_opening    numeric(19,4) := 0;
  v_cash_sales      numeric(19,4) := 0;
  v_cash_expenses   numeric(19,4) := 0;
  v_cash_received   numeric(19,4) := 0;
  v_cash_paid       numeric(19,4) := 0;
  v_cash_purchases  numeric(19,4) := 0;
  v_cash_income     numeric(19,4) := 0;
  v_cash_transfers  numeric(19,4) := 0;

  v_total_sales     numeric(19,4) := 0;
  v_total_cogs      numeric(19,4) := 0;
  v_total_income    numeric(19,4) := 0;
  v_total_expenses  numeric(19,4) := 0;
  v_total_profit    numeric(19,4) := 0;

  v_mobile_money    numeric(19,4) := 0;
  v_bank            numeric(19,4) := 0;
BEGIN
  SELECT COALESCE(SUM(at.amount), 0) INTO v_expected_cash
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id
    AND a.type = 'cash'
    AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_opening
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'opening_balance' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_sales
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'sale' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_income
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'income' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_expenses
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'expense' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_purchases
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'purchase' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_received
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'payment_in' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_paid
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'payment_out' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_transfers
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'transfer' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'sale' AND transaction_date = p_date;

  SELECT COALESCE(SUM(ti.quantity * p.cost), 0) INTO v_total_cogs
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.products p ON p.id = ti.product_id
  WHERE t.business_id = p_business_id AND t.type = 'sale' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_income
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'income' AND transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'expense' AND transaction_date = p_date;

  v_total_profit := (v_total_sales - v_total_cogs) + v_total_income - v_total_expenses;

  -- All mobile money accounts (bKash, Nagad, etc.) aggregated by type
  SELECT COALESCE(SUM(at.amount), 0) INTO v_mobile_money
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id
    AND a.type = 'mobile_money'
    AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_bank
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id
    AND a.type = 'bank'
    AND t.transaction_date <= p_date;

  RETURN jsonb_build_object(
    'expected_cash',  v_expected_cash,
    'cash_opening',   v_cash_opening,
    'cash_sales',     v_cash_sales,
    'cash_expenses',  v_cash_expenses,
    'cash_purchases', v_cash_purchases,
    'cash_income',    v_cash_income,
    'cash_received',  v_cash_received,
    'cash_paid',      v_cash_paid,
    'cash_transfers', v_cash_transfers,
    'total_sales',    v_total_sales,
    'total_cogs',     v_total_cogs,
    'total_income',   v_total_income,
    'total_expenses', v_total_expenses,
    'total_profit',   v_total_profit,
    'balances', jsonb_build_object(
      'cash',         v_expected_cash,
      'mobile_money', v_mobile_money,
      'bank',         v_bank
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
