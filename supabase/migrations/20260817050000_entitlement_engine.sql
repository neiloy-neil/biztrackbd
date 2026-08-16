-- Migration: SaaS Entitlement Engine
-- Provides the core RPC for resolving a business's current plan limits and usage.

-- ==========================================
-- 1. SEED DEFAULT PLANS & FEATURES
-- ==========================================

DO $$ 
DECLARE
  v_free uuid := gen_random_uuid();
  v_starter uuid := gen_random_uuid();
  v_business uuid := gen_random_uuid();
  v_pro uuid := gen_random_uuid();
  v_enterprise uuid := gen_random_uuid();
BEGIN
  -- We only insert if no plans exist yet to prevent duplicating during dev resets
  IF NOT EXISTS (SELECT 1 FROM public.plans) THEN
    -- 1. Free Plan
    INSERT INTO public.plans (id, name, description, price_monthly, price_annual)
    VALUES (v_free, 'Free', 'For individuals just starting out', 0, 0);
    
    INSERT INTO public.plan_features (plan_id, feature_key, limit_value) VALUES
    (v_free, 'max_users', 1),
    (v_free, 'max_branches', 1),
    (v_free, 'max_products', 50),
    (v_free, 'transactions_per_month', 100),
    (v_free, 'inventory', 0),      -- 0 means false
    (v_free, 'pos', 1),            -- 1/null means true for booleans, 1 means enabled here
    (v_free, 'reports', 0),
    (v_free, 'api_access', 0);

    -- 2. Starter Plan
    INSERT INTO public.plans (id, name, description, price_monthly, price_annual)
    VALUES (v_starter, 'Starter', 'For small businesses', 499, 4990);
    
    INSERT INTO public.plan_features (plan_id, feature_key, limit_value) VALUES
    (v_starter, 'max_users', 3),
    (v_starter, 'max_branches', 1),
    (v_starter, 'max_products', 500),
    (v_starter, 'transactions_per_month', 1000),
    (v_starter, 'inventory', 1),
    (v_starter, 'pos', 1),
    (v_starter, 'reports', 1),
    (v_starter, 'api_access', 0);

    -- 3. Business Plan
    INSERT INTO public.plans (id, name, description, price_monthly, price_annual)
    VALUES (v_business, 'Business', 'For growing businesses', 1499, 14990);
    
    INSERT INTO public.plan_features (plan_id, feature_key, limit_value) VALUES
    (v_business, 'max_users', 10),
    (v_business, 'max_branches', 3),
    (v_business, 'max_products', NULL), -- NULL means unlimited
    (v_business, 'transactions_per_month', 10000),
    (v_business, 'inventory', 1),
    (v_business, 'pos', 1),
    (v_business, 'reports', 1),
    (v_business, 'staff_management', 1),
    (v_business, 'multi_branch', 1),
    (v_business, 'api_access', 0);

    -- 4. Pro Plan
    INSERT INTO public.plans (id, name, description, price_monthly, price_annual)
    VALUES (v_pro, 'Pro', 'For established enterprises', 2999, 29990);
    
    INSERT INTO public.plan_features (plan_id, feature_key, limit_value) VALUES
    (v_pro, 'max_users', NULL),
    (v_pro, 'max_branches', 10),
    (v_pro, 'max_products', NULL),
    (v_pro, 'transactions_per_month', NULL),
    (v_pro, 'inventory', 1),
    (v_pro, 'pos', 1),
    (v_pro, 'reports', 1),
    (v_pro, 'staff_management', 1),
    (v_pro, 'multi_branch', 1),
    (v_pro, 'advanced_analytics', 1),
    (v_pro, 'export', 1),
    (v_pro, 'api_access', 1);

    -- 5. Enterprise Plan
    INSERT INTO public.plans (id, name, description, price_monthly, price_annual)
    VALUES (v_enterprise, 'Enterprise', 'Custom high-volume solutions', 9999, 99990);
    
    INSERT INTO public.plan_features (plan_id, feature_key, limit_value) VALUES
    (v_enterprise, 'max_users', NULL),
    (v_enterprise, 'max_branches', NULL),
    (v_enterprise, 'max_products', NULL),
    (v_enterprise, 'transactions_per_month', NULL),
    (v_enterprise, 'inventory', 1),
    (v_enterprise, 'pos', 1),
    (v_enterprise, 'reports', 1),
    (v_enterprise, 'staff_management', 1),
    (v_enterprise, 'multi_branch', 1),
    (v_enterprise, 'advanced_analytics', 1),
    (v_enterprise, 'ai_features', 1),
    (v_enterprise, 'export', 1),
    (v_enterprise, 'api_access', 1);
  END IF;
END $$;


-- ==========================================
-- 2. GET ENTITLEMENTS RPC
-- ==========================================
-- Returns a consolidated JSON payload of a business's current plan, feature limits, and active usage
CREATE OR REPLACE FUNCTION public.get_business_entitlements(p_business_id uuid)
RETURNS json AS $$
DECLARE
  v_plan record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_result json;
BEGIN
  -- 1. Find the active subscription
  SELECT p.id, p.name, s.current_period_start, s.current_period_end
  INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.business_id = p_business_id AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- 2. Fallback to 'Free' plan if no active subscription exists
  IF NOT FOUND THEN
    SELECT id, name INTO v_plan FROM public.plans WHERE name = 'Free' AND is_active = true LIMIT 1;
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';
  ELSE
    v_period_start := v_plan.current_period_start;
    v_period_end := v_plan.current_period_end;
  END IF;

  -- 3. Build the JSON response containing Plan Info, Limits, and Usage
  SELECT json_build_object(
    'plan', json_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'period_start', v_period_start,
      'period_end', v_period_end
    ),
    'features', (
      -- Limits mapped as key-value pairs
      SELECT json_object_agg(feature_key, limit_value)
      FROM public.plan_features
      WHERE plan_id = v_plan.id
    ),
    'usage', (
      -- Current period usage mapped as key-value pairs
      SELECT COALESCE(json_object_agg(feature_key, usage_count), '{}'::json)
      FROM public.usage_records
      WHERE business_id = p_business_id 
        AND period_start >= v_period_start 
        AND period_end <= v_period_end
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
