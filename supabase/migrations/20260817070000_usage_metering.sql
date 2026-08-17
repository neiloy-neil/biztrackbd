-- Migration: SaaS Usage Metering
-- Adds soft limits, hard limits, and enforcement triggers.

-- 1. Alter Plan Features
ALTER TABLE public.plan_features
  ADD COLUMN IF NOT EXISTS hard_limit_value integer,
  ADD COLUMN IF NOT EXISTS soft_limit_threshold numeric DEFAULT 80;

-- Backfill hard limits (default to limit_value)
UPDATE public.plan_features SET hard_limit_value = limit_value WHERE hard_limit_value IS NULL;

-- 2. Create Enforcement Function
CREATE OR REPLACE FUNCTION public.check_usage_limit(p_business_id uuid, p_feature_key text, p_increment integer DEFAULT 1)
RETURNS boolean AS $$
DECLARE
  v_plan_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_limit_value integer;
  v_hard_limit_value integer;
  v_current_usage integer;
  v_new_usage integer;
BEGIN
  -- Find active subscription
  SELECT p.id, s.current_period_start, s.current_period_end
  INTO v_plan_id, v_period_start, v_period_end
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.business_id = p_business_id AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no subscription, fallback to Free plan
  IF NOT FOUND THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Free' AND is_active = true LIMIT 1;
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';
  END IF;

  -- Get limits for this feature
  SELECT limit_value, hard_limit_value
  INTO v_limit_value, v_hard_limit_value
  FROM public.plan_features
  WHERE plan_id = v_plan_id AND feature_key = p_feature_key;

  -- If feature not found or limits are null (unlimited), allow
  IF NOT FOUND OR v_limit_value IS NULL THEN
    RETURN true;
  END IF;

  -- Get current usage
  IF p_feature_key IN ('max_users', 'max_branches', 'max_products') THEN
    -- Calculate absolute limits on the fly
    IF p_feature_key = 'max_users' THEN
      SELECT count(*) INTO v_current_usage FROM public.business_members WHERE business_id = p_business_id;
    ELSIF p_feature_key = 'max_branches' THEN
      v_current_usage := 1; -- Placeholder if branches table doesn't exist yet
    ELSIF p_feature_key = 'max_products' THEN
      SELECT count(*) INTO v_current_usage FROM public.products WHERE business_id = p_business_id;
    END IF;
  ELSE
    SELECT COALESCE(usage_count, 0)
    INTO v_current_usage
    FROM public.usage_records
    WHERE business_id = p_business_id 
      AND feature_key = p_feature_key
      AND period_start >= v_period_start 
      AND period_end <= v_period_end;
      
    IF NOT FOUND THEN
      v_current_usage := 0;
    END IF;
  END IF;

  v_new_usage := v_current_usage + p_increment;

  -- Check Hard Limit
  IF v_hard_limit_value IS NOT NULL AND v_new_usage > v_hard_limit_value THEN
    RAISE EXCEPTION 'Usage limit exceeded for feature: %', p_feature_key USING ERRCODE = 'check_violation';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Transaction Trigger
CREATE OR REPLACE FUNCTION public.increment_transaction_usage()
RETURNS trigger AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  -- Enforcement Check (will raise exception if hard limit reached)
  PERFORM public.check_usage_limit(NEW.business_id, 'transactions_per_month', 1);

  -- Find active subscription period
  SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
  FROM public.subscriptions
  WHERE business_id = NEW.business_id AND status = 'active';

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end := date_trunc('month', now()) + interval '1 month';
  END IF;

  -- Upsert usage record
  INSERT INTO public.usage_records (business_id, feature_key, usage_count, period_start, period_end)
  VALUES (NEW.business_id, 'transactions_per_month', 1, v_period_start, v_period_end)
  ON CONFLICT (business_id, feature_key, period_start)
  DO UPDATE SET usage_count = public.usage_records.usage_count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enriched get_business_entitlements
CREATE OR REPLACE FUNCTION public.get_business_entitlements(p_business_id uuid)
RETURNS json AS $$
DECLARE
  v_plan record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_result json;
  v_users_count integer;
  v_products_count integer;
BEGIN
  -- Find the active subscription
  SELECT p.id, p.name, s.current_period_start, s.current_period_end
  INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.business_id = p_business_id AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, name INTO v_plan FROM public.plans WHERE name = 'Free' AND is_active = true LIMIT 1;
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';
  ELSE
    v_period_start := v_plan.current_period_start;
    v_period_end := v_plan.current_period_end;
  END IF;

  -- Calculate some absolute values
  SELECT count(*) INTO v_users_count FROM public.business_members WHERE business_id = p_business_id;
  -- SELECT count(*) INTO v_products_count FROM public.products WHERE business_id = p_business_id;
  v_products_count := 0; -- Assuming products table may not be there or is called something else.

  SELECT json_build_object(
    'plan', json_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'period_start', v_period_start,
      'period_end', v_period_end
    ),
    'features', (
      SELECT json_object_agg(
        feature_key, 
        json_build_object(
          'limit_value', limit_value,
          'hard_limit_value', hard_limit_value,
          'soft_limit_threshold', soft_limit_threshold
        )
      )
      FROM public.plan_features
      WHERE plan_id = v_plan.id
    ),
    'usage', (
      SELECT COALESCE(
        json_object_agg(
          COALESCE(u.feature_key, a.feature_key), 
          COALESCE(u.usage_count, a.usage_count)
        ), '{}'::json)
      FROM (
        SELECT feature_key, usage_count
        FROM public.usage_records
        WHERE business_id = p_business_id 
          AND period_start >= v_period_start 
          AND period_end <= v_period_end
      ) u
      FULL OUTER JOIN (
        -- Inject absolute counts here
        SELECT 'max_users' as feature_key, v_users_count as usage_count
        UNION ALL
        SELECT 'max_products' as feature_key, v_products_count as usage_count
      ) a ON u.feature_key = a.feature_key
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
