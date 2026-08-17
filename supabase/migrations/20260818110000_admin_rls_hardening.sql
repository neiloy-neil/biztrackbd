-- Admin RLS Hardening
-- 1. Coupons: drop open SELECT that lets any user enumerate promo codes.
-- 2. Plan features: scope public SELECT to active plans only.

-- Coupons
DROP POLICY IF EXISTS "Anyone views active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;

CREATE POLICY "Admins manage coupons"
  ON public.coupons
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Plan features
DROP POLICY IF EXISTS "Anyone views plan features" ON public.plan_features;
DROP POLICY IF EXISTS "Plan features visible for active plans" ON public.plan_features;

CREATE POLICY "Plan features visible for active plans"
  ON public.plan_features
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plans
      WHERE plans.id = plan_features.plan_id
        AND plans.is_active = true
    )
  );
