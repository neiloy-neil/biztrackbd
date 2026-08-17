-- Migration: SaaS Promotion System (Coupons, Trials, Credits)

-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE public.discount_type AS ENUM (
  'percentage',
  'fixed'
);

CREATE TYPE public.coupon_duration AS ENUM (
  'once',             -- First month only / one time
  'repeating',        -- Multiple months
  'forever'           -- Entire billing period
);

CREATE TYPE public.customer_eligibility AS ENUM (
  'new_only',         -- New customers only
  'all'               -- Existing customers allowed
);

-- ==========================================
-- 2. COUPONS TABLE
-- ==========================================
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type public.discount_type NOT NULL,
  value numeric(19,4) NOT NULL CHECK (value > 0),
  duration public.coupon_duration NOT NULL DEFAULT 'once',
  duration_in_months integer, -- Only used if duration is 'repeating'
  target_plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE, -- NULL means applicable to all plans
  eligibility public.customer_eligibility NOT NULL DEFAULT 'all',
  max_redemptions integer, -- NULL means unlimited overall uses
  redemptions_count integer DEFAULT 0 NOT NULL,
  per_business_limit integer DEFAULT 1 NOT NULL, -- How many times one business can use this
  expires_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. COUPON REDEMPTIONS TABLE
-- ==========================================
-- Tracks which business redeemed which coupon
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  months_remaining integer, -- Derived from duration_in_months, decrements every billing cycle
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 4. PROMOTIONAL CREDITS
-- ==========================================
CREATE TABLE public.promotional_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  amount numeric(19,4) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Wallet Balance view or function can aggregate available credits.

-- ==========================================
-- 5. RLS POLICIES
-- ==========================================
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_credits ENABLE ROW LEVEL SECURITY;

-- Coupons: Admins can do anything. Public can read active coupons (needed for client-side validation).
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL USING (public.is_platform_admin());
CREATE POLICY "Anyone views active coupons" ON public.coupons FOR SELECT USING (is_active = true);

-- Redemptions: Admins manage all, tenants view own
CREATE POLICY "Admins manage redemptions" ON public.coupon_redemptions FOR ALL USING (public.is_platform_admin());
CREATE POLICY "Tenants view own redemptions" ON public.coupon_redemptions FOR SELECT USING (public.is_business_member(business_id));

-- Credits: Admins manage all, tenants view own
CREATE POLICY "Admins manage credits" ON public.promotional_credits FOR ALL USING (public.is_platform_admin());
CREATE POLICY "Tenants view own credits" ON public.promotional_credits FOR SELECT USING (public.is_business_member(business_id));

-- ==========================================
-- 6. RPCs FOR VALIDATION AND ACTIONS
-- ==========================================

-- A function to safely validate a coupon before allowing redemption
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text, 
  p_business_id uuid,
  p_plan_id uuid
) RETURNS json AS $$
DECLARE
  v_coupon record;
  v_usage_count integer;
  v_has_previous_subs boolean;
BEGIN
  -- 1. Find coupon
  SELECT * INTO v_coupon FROM public.coupons WHERE code = p_code AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or inactive coupon code.');
  END IF;

  -- 2. Check Expiry
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'This coupon has expired.');
  END IF;

  -- 3. Check global usage limit
  IF v_coupon.max_redemptions IS NOT NULL AND v_coupon.redemptions_count >= v_coupon.max_redemptions THEN
    RETURN json_build_object('valid', false, 'error', 'This coupon has reached its maximum usage limit.');
  END IF;

  -- 4. Check plan target
  IF v_coupon.target_plan_id IS NOT NULL AND v_coupon.target_plan_id != p_plan_id THEN
    RETURN json_build_object('valid', false, 'error', 'This coupon is not valid for the selected plan.');
  END IF;

  -- 5. Check per-business limit
  SELECT count(*) INTO v_usage_count FROM public.coupon_redemptions 
  WHERE coupon_id = v_coupon.id AND business_id = p_business_id;

  IF v_usage_count >= v_coupon.per_business_limit THEN
    RETURN json_build_object('valid', false, 'error', 'You have already used this coupon.');
  END IF;

  -- 6. Check new customer eligibility
  IF v_coupon.eligibility = 'new_only' THEN
    -- Check if the business already has an active or past_due subscription
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions 
      WHERE business_id = p_business_id AND status IN ('active', 'past_due', 'canceled')
    ) INTO v_has_previous_subs;

    IF v_has_previous_subs THEN
      RETURN json_build_object('valid', false, 'error', 'This coupon is for new customers only.');
    END IF;
  END IF;

  -- If we get here, it's valid
  RETURN json_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'type', v_coupon.type,
    'value', v_coupon.value,
    'duration', v_coupon.duration,
    'duration_in_months', v_coupon.duration_in_months
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- A function to redeem a coupon securely
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code text,
  p_business_id uuid,
  p_plan_id uuid
) RETURNS json AS $$
DECLARE
  v_validation json;
  v_coupon_id uuid;
  v_months integer;
BEGIN
  -- Re-validate completely
  v_validation := public.validate_coupon(p_code, p_business_id, p_plan_id);
  
  IF NOT (v_validation->>'valid')::boolean THEN
    RAISE EXCEPTION '%', v_validation->>'error';
  END IF;

  v_coupon_id := (v_validation->>'coupon_id')::uuid;
  
  IF v_validation->>'duration' = 'repeating' THEN
    v_months := (v_validation->>'duration_in_months')::integer;
  ELSIF v_validation->>'duration' = 'once' THEN
    v_months := 1;
  ELSE
    v_months := NULL; -- forever
  END IF;

  -- Insert redemption
  INSERT INTO public.coupon_redemptions (coupon_id, business_id, months_remaining)
  VALUES (v_coupon_id, p_business_id, v_months);

  -- Increment global usage count
  UPDATE public.coupons SET redemptions_count = redemptions_count + 1 WHERE id = v_coupon_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- A function to extend a business trial
CREATE OR REPLACE FUNCTION public.extend_trial(
  p_business_id uuid,
  p_days integer
) RETURNS json AS $$
DECLARE
  v_sub record;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  -- Find the subscription (assuming one active/trialing sub per business)
  SELECT * INTO v_sub FROM public.subscriptions 
  WHERE business_id = p_business_id 
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for this business.';
  END IF;

  IF v_sub.status != 'trialing' THEN
    RAISE EXCEPTION 'Cannot extend trial. Subscription is not in trialing state.';
  END IF;

  UPDATE public.subscriptions 
  SET current_period_end = current_period_end + (p_days || ' days')::interval,
      updated_at = now()
  WHERE id = v_sub.id;

  RETURN json_build_object('success', true, 'new_end_date', v_sub.current_period_end + (p_days || ' days')::interval);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
