-- ==========================================
-- REPLACE POLICIES ON SAAS TABLES
-- ==========================================

-- platform_admins
DROP POLICY IF EXISTS "Admins view admins" ON public.platform_admins;
CREATE POLICY "Admins view admins" ON public.platform_admins FOR SELECT USING (public.has_platform_permission('platform.admins.manage'));

-- plans
DROP POLICY IF EXISTS "Anyone views active plans" ON public.plans;
CREATE POLICY "Anyone views active plans" ON public.plans FOR SELECT USING (is_active = true OR public.has_platform_permission('platform.plans.manage'));

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.has_platform_permission('platform.plans.manage'));

-- plan_features
DROP POLICY IF EXISTS "Admins manage plan features" ON public.plan_features;
CREATE POLICY "Admins manage plan features" ON public.plan_features FOR ALL USING (public.has_platform_permission('platform.features.manage'));

-- subscriptions
DROP POLICY IF EXISTS "Tenant isolation SELECT subscriptions" ON public.subscriptions;
CREATE POLICY "Tenant isolation SELECT subscriptions" ON public.subscriptions FOR SELECT USING (public.is_business_member(business_id) OR public.has_platform_permission('platform.billing.view'));

DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL USING (public.has_platform_permission('platform.billing.manage'));

-- usage_records
DROP POLICY IF EXISTS "Tenant isolation SELECT usage_records" ON public.usage_records;
CREATE POLICY "Tenant isolation SELECT usage_records" ON public.usage_records FOR SELECT USING (public.is_business_member(business_id) OR public.has_platform_permission('platform.billing.view'));

-- invoices
DROP POLICY IF EXISTS "Tenant isolation SELECT invoices" ON public.invoices;
CREATE POLICY "Tenant isolation SELECT invoices" ON public.invoices FOR SELECT USING (public.is_business_member(business_id) OR public.has_platform_permission('platform.billing.view'));

-- coupons
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL USING (public.has_platform_permission('platform.coupons.manage'));

DROP POLICY IF EXISTS "Admins manage redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins manage redemptions" ON public.coupon_redemptions FOR ALL USING (public.has_platform_permission('platform.coupons.manage'));

DROP POLICY IF EXISTS "Admins manage credits" ON public.promotional_credits;
CREATE POLICY "Admins manage credits" ON public.promotional_credits FOR ALL USING (public.has_platform_permission('platform.billing.manage'));

-- audit logs
DROP POLICY IF EXISTS "Admins view audit logs" ON public.platform_audit_logs;
CREATE POLICY "Admins view audit logs" ON public.platform_audit_logs
    FOR SELECT USING (has_platform_permission('platform.audit.view'));

-- support tickets
DROP POLICY IF EXISTS "Users can view their tickets" ON public.support_tickets;
CREATE POLICY "Users can view their tickets" ON public.support_tickets FOR SELECT USING (public.is_business_member(business_id) OR public.has_platform_permission('platform.support.manage'));

DROP POLICY IF EXISTS "Admins can update tickets" ON public.support_tickets;
CREATE POLICY "Admins can update tickets" ON public.support_tickets FOR UPDATE USING (public.has_platform_permission('platform.support.manage'));

DROP POLICY IF EXISTS "Anyone can read replies" ON public.support_ticket_messages;
CREATE POLICY "Anyone can read replies" ON public.support_ticket_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id AND public.is_business_member(t.business_id)
  ) OR public.has_platform_permission('platform.support.manage')
);

DROP POLICY IF EXISTS "Admins can insert replies" ON public.support_ticket_messages;
CREATE POLICY "Admins can insert replies" ON public.support_ticket_messages FOR INSERT WITH CHECK (
  public.has_platform_permission('platform.support.manage')
);

-- feature flags
DROP POLICY IF EXISTS "Admins manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins manage feature flags" ON public.feature_flags FOR ALL USING (public.has_platform_permission('platform.features.manage'));

-- notifications
DROP POLICY IF EXISTS "Admins manage platform notifications" ON public.platform_notifications;
CREATE POLICY "Admins manage platform notifications" ON public.platform_notifications FOR ALL USING (public.has_platform_permission('platform.notifications.manage'));

DROP POLICY IF EXISTS "Admins manage notification preferences" ON public.notification_preferences;
CREATE POLICY "Admins manage notification preferences" ON public.notification_preferences FOR ALL USING (public.has_platform_permission('platform.notifications.manage'));

-- ==========================================
-- UPDATE ALL EXISTING ADMIN RPCS
-- ==========================================

-- We must redefine the RPCs to use has_platform_permission

CREATE OR REPLACE FUNCTION public.get_platform_metrics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_platform_permission('platform.dashboard.view') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object('status', 'ok') INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_mrr_metrics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_platform_permission('platform.dashboard.view') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object('status', 'ok') INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_all_businesses()
RETURNS TABLE (id uuid, name text) AS $$
BEGIN
  IF NOT public.has_platform_permission('platform.businesses.view') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT b.id, b.name FROM public.businesses b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.suspend_business(target_business_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.has_platform_permission('platform.businesses.manage') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.businesses SET is_active = false WHERE id = target_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.suspend_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.has_platform_permission('platform.users.manage') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- placeholder implementation for overrides
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kept is_platform_admin() for backwards compatibility where needed
-- DROP FUNCTION IF EXISTS public.is_platform_admin();
