-- Migration: Feature Flag System

-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE public.flag_target_type AS ENUM ('business', 'user');

-- ==========================================
-- 2. TABLES
-- ==========================================
CREATE TABLE public.feature_flags (
  id text PRIMARY KEY,
  description text,
  is_global_enabled boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.feature_flag_plans (
  flag_id text REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  PRIMARY KEY (flag_id, plan_id)
);

CREATE TABLE public.feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id text REFERENCES public.feature_flags(id) ON DELETE CASCADE NOT NULL,
  target_type public.flag_target_type NOT NULL,
  target_id uuid NOT NULL,
  is_enabled boolean NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (flag_id, target_type, target_id)
);

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage all flags
CREATE POLICY "Admins manage feature flags" ON public.feature_flags 
FOR ALL USING (public.is_platform_admin());

-- Everyone can read feature flags (used by the RPC mostly, but good for client side fetches if needed)
CREATE POLICY "Anyone read feature flags" ON public.feature_flags 
FOR SELECT USING (true);

-- Admins manage plans
CREATE POLICY "Admins manage feature flag plans" ON public.feature_flag_plans 
FOR ALL USING (public.is_platform_admin());

CREATE POLICY "Anyone read feature flag plans" ON public.feature_flag_plans 
FOR SELECT USING (true);

-- Admins manage overrides
CREATE POLICY "Admins manage feature flag overrides" ON public.feature_flag_overrides 
FOR ALL USING (public.is_platform_admin());

CREATE POLICY "Anyone read feature flag overrides" ON public.feature_flag_overrides 
FOR SELECT USING (true);


-- ==========================================
-- 4. EVALUATION RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.evaluate_feature_flag(
  p_flag_id text,
  p_business_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_override boolean;
  v_plan_id uuid;
  v_plan_enabled boolean;
  v_global_enabled boolean;
BEGIN
  -- 1. Check User Override
  IF p_user_id IS NOT NULL THEN
    SELECT is_enabled INTO v_override
    FROM public.feature_flag_overrides
    WHERE flag_id = p_flag_id AND target_type = 'user' AND target_id = p_user_id;
    
    IF FOUND THEN
      RETURN v_override;
    END IF;
  END IF;

  -- 2. Check Business Override
  IF p_business_id IS NOT NULL THEN
    SELECT is_enabled INTO v_override
    FROM public.feature_flag_overrides
    WHERE flag_id = p_flag_id AND target_type = 'business' AND target_id = p_business_id;
    
    IF FOUND THEN
      RETURN v_override;
    END IF;

    -- 3. Check Plan Entitlement (if no explicit business override)
    -- Find active subscription for business
    SELECT plan_id INTO v_plan_id
    FROM public.subscriptions
    WHERE business_id = p_business_id 
      AND status IN ('active', 'trialing') 
    LIMIT 1;

    IF FOUND THEN
      SELECT true INTO v_plan_enabled
      FROM public.feature_flag_plans
      WHERE flag_id = p_flag_id AND plan_id = v_plan_id;
      
      IF FOUND THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- 4. Check Global Fallback
  SELECT is_global_enabled INTO v_global_enabled
  FROM public.feature_flags
  WHERE id = p_flag_id;
  
  IF FOUND THEN
    RETURN v_global_enabled;
  END IF;

  -- Default to false if flag doesn't exist
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
