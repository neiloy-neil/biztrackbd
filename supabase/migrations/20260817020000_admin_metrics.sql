-- Migration: Platform Admin Metrics
-- Contains RPCs specifically for the Super Admin dashboard

-- ==========================================
-- 1. PLATFORM METRICS SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_platform_metrics_summary()
RETURNS json AS $$
DECLARE
  v_total_businesses bigint;
  v_active_businesses bigint;
  v_new_businesses_today bigint;
  v_new_businesses_month bigint;
  
  v_mrr numeric(19,4) := 0;
  v_arr numeric(19,4) := 0;
  v_paid_subs bigint := 0;
  v_free_subs bigint := 0;
  v_trial_subs bigint := 0;
  
  v_total_txns bigint := 0;
  v_txns_today bigint := 0;
  v_txns_month bigint := 0;
  
  v_failed_payments bigint := 0;
BEGIN
  -- Verify platform admin access
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  -- 1. Business Metrics
  SELECT count(*) INTO v_total_businesses FROM public.businesses;
  
  -- Rough proxy for active business: had a transaction in the last 30 days
  SELECT count(DISTINCT business_id) INTO v_active_businesses 
  FROM public.transactions 
  WHERE created_at >= (now() - interval '30 days');

  SELECT count(*) INTO v_new_businesses_today 
  FROM public.businesses 
  WHERE created_at >= current_date;

  SELECT count(*) INTO v_new_businesses_month 
  FROM public.businesses 
  WHERE created_at >= date_trunc('month', current_date);

  -- 2. Revenue Metrics
  -- MRR is roughly active subscriptions monthly price + annual price / 12
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN p.price_monthly > 0 THEN p.price_monthly 
        WHEN p.price_annual > 0 THEN p.price_annual / 12.0
        ELSE 0 
      END
    ), 0),
    COALESCE(SUM(
      CASE 
        WHEN p.price_annual > 0 THEN p.price_annual 
        WHEN p.price_monthly > 0 THEN p.price_monthly * 12.0
        ELSE 0 
      END
    ), 0),
    COUNT(*) FILTER (WHERE p.price_monthly > 0 OR p.price_annual > 0),
    COUNT(*) FILTER (WHERE p.price_monthly = 0 AND p.price_annual = 0 AND s.status = 'active'),
    COUNT(*) FILTER (WHERE s.status = 'trialing')
  INTO 
    v_mrr, v_arr, v_paid_subs, v_free_subs, v_trial_subs
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.status IN ('active', 'trialing');

  -- Failed payments (unpaid invoices past due)
  SELECT count(*) INTO v_failed_payments
  FROM public.invoices
  WHERE status IN ('open', 'uncollectible') AND due_date < now();

  -- 3. Usage Metrics
  SELECT count(*) INTO v_total_txns FROM public.transactions;
  
  SELECT count(*) INTO v_txns_today 
  FROM public.transactions 
  WHERE transaction_date = current_date;

  SELECT count(*) INTO v_txns_month 
  FROM public.transactions 
  WHERE transaction_date >= date_trunc('month', current_date);

  -- Return JSON
  RETURN json_build_object(
    'total_businesses', v_total_businesses,
    'active_businesses', v_active_businesses,
    'new_businesses_today', v_new_businesses_today,
    'new_businesses_month', v_new_businesses_month,
    'mrr', v_mrr,
    'arr', v_arr,
    'paid_subscriptions', v_paid_subs,
    'free_subscriptions', v_free_subs,
    'trial_subscriptions', v_trial_subs,
    'failed_payments', v_failed_payments,
    'total_transactions', v_total_txns,
    'transactions_today', v_txns_today,
    'transactions_month', v_txns_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. PLATFORM CHART DATA (TIME SERIES)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_platform_growth_data()
RETURNS TABLE (
  month_date text,
  new_businesses integer,
  active_businesses integer
) AS $$
BEGIN
  -- Verify platform admin access
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now() - interval '5 months'),
      date_trunc('month', now()),
      '1 month'::interval
    ) AS m
  ),
  business_creation AS (
    SELECT date_trunc('month', created_at) AS b_month, count(*) AS count
    FROM public.businesses
    GROUP BY b_month
  ),
  active_biz AS (
    SELECT date_trunc('month', transaction_date) AS t_month, count(DISTINCT business_id) AS count
    FROM public.transactions
    GROUP BY t_month
  )
  SELECT 
    to_char(m.m, 'Mon YYYY') as month_date,
    COALESCE(bc.count, 0)::integer as new_businesses,
    COALESCE(ab.count, 0)::integer as active_businesses
  FROM months m
  LEFT JOIN business_creation bc ON m.m = bc.b_month
  LEFT JOIN active_biz ab ON m.m = ab.t_month
  ORDER BY m.m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
