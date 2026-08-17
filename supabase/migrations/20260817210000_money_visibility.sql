-- Migration: Money Visibility RPC
-- Returns per-account balances, top debtors/payables, 7-day profit trend,
-- and last 7 closing variances — all in one round-trip.

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

  -- Per-account balances (cash, bank, mobile_money)
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

  -- Top 5 customers by outstanding due (uses cached current_due column)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',          id,
    'name',        name,
    'phone',       phone,
    'current_due', current_due
  )), '[]'::jsonb)
  INTO v_top_debtors
  FROM (
    SELECT id, name, phone, current_due
    FROM parties
    WHERE business_id = p_business_id
      AND type IN ('customer', 'both')
      AND current_due > 0
      AND deleted_at IS NULL
    ORDER BY current_due DESC
    LIMIT 5
  ) d;

  -- Top 5 suppliers by outstanding payable (uses cached current_due column)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',          id,
    'name',        name,
    'phone',       phone,
    'current_due', current_due
  )), '[]'::jsonb)
  INTO v_top_payables
  FROM (
    SELECT id, name, phone, current_due
    FROM parties
    WHERE business_id = p_business_id
      AND type IN ('supplier', 'both')
      AND current_due > 0
      AND deleted_at IS NULL
    ORDER BY current_due DESC
    LIMIT 5
  ) s;

  -- Last 7 days daily profit (sales - expenses)
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

  -- Last 7 daily closings (oldest→newest for chart rendering)
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
