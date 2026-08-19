-- get_dashboard_summary was summing parties.current_due (a stale cached column)
-- instead of v_party_balances.current_due (recalculated from transactions).
-- This caused the dashboard's "total due" to include garbage cached values from
-- parties whose balance had been updated by POS payments (account_transactions)
-- without the trigger updating the cached column.
--
-- Root cause: parties.current_due is only updated by trg_update_party_balance
-- on manual transactions, but POS payments go through account_transactions
-- which do not fire that trigger. v_party_balances recalculates from scratch.
--
-- Fix: switch customer_due / supplier_due aggregation to v_party_balances.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_business_id uuid, p_start_date date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_sales      numeric(19,4) := 0;
  v_total_income     numeric(19,4) := 0;
  v_total_cogs       numeric(19,4) := 0;
  v_total_expenses   numeric(19,4) := 0;
  v_gross_profit     numeric(19,4) := 0;
  v_net_profit       numeric(19,4) := 0;
  v_customer_due     numeric(19,4) := 0;
  v_supplier_due     numeric(19,4) := 0;
  v_available_money  numeric(19,4) := 0;
  v_low_stock_count  int := 0;
BEGIN
  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'income'), 0)
  INTO v_total_sales, v_total_income
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  SELECT COALESCE(SUM(ti.quantity * p.cost), 0) INTO v_total_cogs
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.products p ON p.id = ti.product_id
  WHERE t.business_id = p_business_id
    AND t.state = 'completed'
    AND t.type = 'sale'
    AND t.transaction_date >= p_start_date
    AND t.transaction_date <= p_end_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND type = 'expense'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  v_gross_profit := v_total_sales - v_total_cogs;
  v_net_profit   := v_gross_profit + v_total_income - v_total_expenses;

  SELECT
    COALESCE(SUM(current_due) FILTER (WHERE type IN ('customer', 'both')), 0),
    COALESCE(SUM(current_due) FILTER (WHERE type IN ('supplier', 'both')), 0)
  INTO v_customer_due, v_supplier_due
  FROM public.v_party_balances
  WHERE business_id = p_business_id;

  SELECT COALESCE(SUM(current_balance), 0) INTO v_available_money
  FROM public.accounts
  WHERE business_id = p_business_id
    AND type IN ('cash', 'bank')
    AND deleted_at IS NULL;

  SELECT (EXISTS (
    SELECT 1
    FROM public.products
    WHERE business_id = p_business_id
      AND deleted_at IS NULL
      AND current_stock <= min_stock
    LIMIT 1
  ))::int INTO v_low_stock_count;

  RETURN jsonb_build_object(
    'total_revenue',    v_total_sales + v_total_income,
    'total_sales',      v_total_sales,
    'total_income',     v_total_income,
    'total_cogs',       v_total_cogs,
    'gross_profit',     v_gross_profit,
    'total_expenses',   v_total_expenses,
    'net_profit',       v_net_profit,
    'customer_due',     v_customer_due,
    'supplier_due',     v_supplier_due,
    'available_money',  v_available_money,
    'low_stock_count',  v_low_stock_count
  );
END;
$function$;
