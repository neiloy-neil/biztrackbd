-- =============================================================
-- Migration: Business Health Score RPC
-- Provides aggregated metrics for calculating the Business Health Score.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_business_health_score(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS json AS $$
DECLARE
  v_total_revenue numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_total_cogs numeric(19,4) := 0;
  v_net_cash_flow numeric(19,4) := 0;
  v_customer_due numeric(19,4) := 0;

  v_cash_score int := 0;
  v_rec_score int := 0;
  v_prof_score int := 0;
  v_total_score int := 0;
  
  v_net_profit numeric(19,4) := 0;
  v_profit_margin numeric(19,4) := 0;
  v_due_ratio numeric(19,4) := 0;
BEGIN
  -- Verify ownership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Total Revenue (Sales + Income)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_revenue
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type IN ('sale', 'income')
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- 2. Total Expenses & COGS
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_cogs
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'purchase'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- 3. Net Cash Flow
  SELECT COALESCE(SUM(amount), 0) INTO v_net_cash_flow
  FROM public.account_transactions at
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE t.business_id = p_business_id
    AND t.state = 'completed'
    AND t.transaction_date >= p_start_date
    AND t.transaction_date <= p_end_date;

  -- 4. Customer Dues (Current total due across all customers)
  SELECT COALESCE(SUM(current_due), 0) INTO v_customer_due
  FROM public.parties
  WHERE business_id = p_business_id AND type IN ('customer', 'both');

  -- CALCULATE SCORES
  
  -- Cash Flow (40 pts)
  IF v_net_cash_flow > 0 THEN
    v_cash_score := 40;
  ELSIF v_total_revenue > 0 AND ABS(v_net_cash_flow) <= (v_total_revenue * 0.10) THEN
    v_cash_score := 20;
  ELSE
    v_cash_score := 0;
  END IF;

  -- Receivables (30 pts)
  IF v_total_revenue > 0 THEN
    v_due_ratio := v_customer_due / v_total_revenue;
    IF v_due_ratio < 0.15 THEN
      v_rec_score := 30;
    ELSIF v_due_ratio <= 0.30 THEN
      v_rec_score := 15;
    ELSE
      v_rec_score := 0;
    END IF;
  ELSE
    -- If no revenue, assume max score if due is 0, else 0
    IF v_customer_due = 0 THEN v_rec_score := 30; ELSE v_rec_score := 0; END IF;
  END IF;

  -- Profitability (30 pts)
  v_net_profit := v_total_revenue - (v_total_expenses + v_total_cogs);
  IF v_total_revenue > 0 THEN
    v_profit_margin := v_net_profit / v_total_revenue;
    IF v_profit_margin > 0.15 THEN
      v_prof_score := 30;
    ELSIF v_profit_margin >= 0.05 THEN
      v_prof_score := 15;
    ELSE
      v_prof_score := 0;
    END IF;
  ELSE
    v_prof_score := 0;
  END IF;

  v_total_score := v_cash_score + v_rec_score + v_prof_score;

  RETURN json_build_object(
    'total_score', v_total_score,
    'cash_flow', json_build_object(
      'score', v_cash_score,
      'net', v_net_cash_flow,
      'max', 40
    ),
    'receivables', json_build_object(
      'score', v_rec_score,
      'due', v_customer_due,
      'ratio', v_due_ratio,
      'max', 30
    ),
    'profitability', json_build_object(
      'score', v_prof_score,
      'margin', v_profit_margin,
      'net_profit', v_net_profit,
      'max', 30
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
