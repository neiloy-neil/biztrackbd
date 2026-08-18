-- Fix: get_money_visibility and get_actionable_insights use cached parties.current_due
-- which diverges from v_party_balances after POS payments (account_transactions).
-- Switch both RPCs to query v_party_balances so the dashboard matches the party detail page.

CREATE OR REPLACE FUNCTION get_money_visibility(p_business_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_accounts     jsonb;
  v_top_debtors  jsonb;
  v_top_payables jsonb;
  v_profit_trend jsonb;
  v_closings     jsonb;
  v_today        date := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  IF NOT is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',      a.id,
    'name',    a.name,
    'type',    a.type,
    'balance', COALESCE(SUM(at.amount), 0)
  ) ORDER BY a.type, a.name), '[]'::jsonb)
  INTO v_accounts
  FROM accounts a
  LEFT JOIN account_transactions at ON at.account_id = a.id
  WHERE a.business_id = p_business_id AND a.deleted_at IS NULL
  GROUP BY a.id, a.name, a.type;

  -- Top 5 customers by outstanding due (uses v_party_balances for accuracy)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',          id,
    'name',        name,
    'phone',       phone,
    'current_due', current_due
  )), '[]'::jsonb)
  INTO v_top_debtors
  FROM (
    SELECT id, name, phone, current_due
    FROM v_party_balances
    WHERE business_id = p_business_id
      AND type IN ('customer', 'both')
      AND current_due > 0
    ORDER BY current_due DESC
    LIMIT 5
  ) d;

  -- Top 5 suppliers by outstanding payable (uses v_party_balances for accuracy)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',          id,
    'name',        name,
    'phone',       phone,
    'current_due', current_due
  )), '[]'::jsonb)
  INTO v_top_payables
  FROM (
    SELECT id, name, phone, current_due
    FROM v_party_balances
    WHERE business_id = p_business_id
      AND type IN ('supplier', 'both')
      AND current_due > 0
    ORDER BY current_due DESC
    LIMIT 5
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date',   d.day::text,
    'profit', COALESCE(SUM(
      CASE WHEN t.type = 'sale'    THEN  t.total_amount
           WHEN t.type = 'expense' THEN -t.total_amount
           ELSE 0 END
    ), 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO v_profit_trend
  FROM (
    SELECT generate_series(
      v_today::timestamp - INTERVAL '6 days',
      v_today::timestamp,
      '1 day'::interval
    )::date AS day
  ) d
  LEFT JOIN transactions t
    ON t.transaction_date = d.day
   AND t.business_id     = p_business_id
   AND t.state           = 'completed'
   AND t.type            IN ('sale', 'expense')
  GROUP BY d.day;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date',          closing_date::text,
    'difference',    difference,
    'actual_cash',   actual_cash,
    'expected_cash', expected_cash
  ) ORDER BY closing_date), '[]'::jsonb)
  INTO v_closings
  FROM (
    SELECT closing_date, difference, actual_cash, expected_cash
    FROM daily_closings
    WHERE business_id = p_business_id
    ORDER BY closing_date DESC
    LIMIT 7
  ) c;

  RETURN json_build_object(
    'accounts',     v_accounts,
    'top_debtors',  v_top_debtors,
    'top_payables', v_top_payables,
    'profit_trend', v_profit_trend,
    'closings',     v_closings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_money_visibility(uuid) TO authenticated;

-- Also fix get_actionable_insights top_debtors to use v_party_balances
CREATE OR REPLACE FUNCTION public.get_actionable_insights(
  p_business_id uuid
) RETURNS json AS $$
DECLARE
  v_low_stock json;
  v_top_debtors json;
  v_expense_spikes json;
  v_top_selling json;
  v_this_week_expenses numeric(19,4) := 0;
  v_last_week_expenses numeric(19,4) := 0;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'current_stock', p.current_stock,
      'min_stock', p.min_stock
    )
  ), '[]'::json) INTO v_low_stock
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.current_stock <= p.min_stock
    AND p.min_stock > 0
    AND p.deleted_at IS NULL
  LIMIT 5;

  -- Use v_party_balances so balance matches the party detail page
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', pt.id,
      'name', pt.name,
      'phone', pt.phone,
      'current_due', pt.current_due
    )
  ), '[]'::json) INTO v_top_debtors
  FROM public.v_party_balances pt
  WHERE pt.business_id = p_business_id
    AND pt.type IN ('customer', 'both')
    AND pt.current_due > 0
  ORDER BY pt.current_due DESC
  LIMIT 5;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= current_date - interval '7 days';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= current_date - interval '14 days'
    AND transaction_date < current_date - interval '7 days';

  v_expense_spikes := json_build_object(
    'this_week', v_this_week_expenses,
    'last_week', v_last_week_expenses,
    'spike_percentage', CASE
      WHEN v_last_week_expenses > 0 THEN
        ROUND(((v_this_week_expenses - v_last_week_expenses) / v_last_week_expenses) * 100, 2)
      ELSE 0
    END
  );

  SELECT COALESCE(json_agg(
    json_build_object(
      'product_id', sub.product_id,
      'name', p.name,
      'total_sold', sub.total_sold
    )
  ), '[]'::json) INTO v_top_selling
  FROM (
    SELECT product_id, SUM(quantity) as total_sold
    FROM public.inventory_movements
    WHERE business_id = p_business_id
      AND type = 'out'
      AND created_at >= current_date - interval '30 days'
    GROUP BY product_id
    ORDER BY total_sold DESC
    LIMIT 5
  ) sub
  JOIN public.products p ON p.id = sub.product_id;

  RETURN json_build_object(
    'low_stock', v_low_stock,
    'top_debtors', v_top_debtors,
    'expense_spikes', v_expense_spikes,
    'top_selling', v_top_selling
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
