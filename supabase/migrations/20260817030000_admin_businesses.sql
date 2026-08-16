-- Migration: Admin Business Management RPCs
-- Adds status to businesses and provides optimized queries for the Super Admin dashboard

-- ==========================================
-- 1. ADD STATUS TO BUSINESSES
-- ==========================================
CREATE TYPE public.business_status AS ENUM ('active', 'suspended', 'deleted');

ALTER TABLE public.businesses 
  ADD COLUMN status public.business_status DEFAULT 'active' NOT NULL,
  ADD COLUMN deleted_at timestamptz;

-- Update the existing RLS policy to hide deleted businesses from standard users
DROP POLICY IF EXISTS "Users view joined businesses" ON public.businesses;
CREATE POLICY "Users view joined businesses" ON public.businesses 
  FOR SELECT USING (
    id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()) 
    AND status != 'deleted'
  );

-- Admins can view all businesses, including deleted ones
CREATE POLICY "Admins view all businesses" ON public.businesses 
  FOR SELECT USING (public.is_platform_admin());

-- ==========================================
-- 2. LIST VIEW RPC
-- ==========================================
-- Returns an aggregated list of businesses with owner details and subscription status
CREATE OR REPLACE FUNCTION public.get_platform_businesses_list(
  search_query text DEFAULT NULL,
  filter_status text DEFAULT NULL,
  filter_plan text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  created_at timestamptz,
  owner_phone text,
  plan_name text,
  subscription_status text,
  user_count bigint,
  branch_count bigint,
  last_active timestamptz
) AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  RETURN QUERY
  WITH owner_data AS (
    -- Get the primary owner's phone number
    SELECT DISTINCT ON (bm.business_id) bm.business_id, au.raw_user_meta_data->>'phone' as phone
    FROM public.business_members bm
    JOIN auth.users au ON bm.user_id = au.id
    WHERE bm.role = 'owner'
  ),
  counts AS (
    SELECT 
      b.id as business_id,
      (SELECT count(*) FROM public.business_members WHERE business_id = b.id) as u_count,
      (SELECT count(*) FROM public.branches WHERE business_id = b.id) as b_count,
      (SELECT MAX(transaction_date)::timestamptz FROM public.transactions WHERE business_id = b.id) as l_active
    FROM public.businesses b
  ),
  sub_data AS (
    SELECT DISTINCT ON (s.business_id) s.business_id, p.name as plan_name, s.status::text as sub_status
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.status IN ('active', 'trialing', 'past_due') -- Prefer active
  )
  SELECT 
    b.id,
    b.name,
    b.status::text,
    b.created_at,
    o.phone as owner_phone,
    COALESCE(sd.plan_name, 'Free / No Plan') as plan_name,
    COALESCE(sd.sub_status, 'none') as subscription_status,
    COALESCE(c.u_count, 0) as user_count,
    COALESCE(c.b_count, 0) as branch_count,
    c.l_active as last_active
  FROM public.businesses b
  LEFT JOIN owner_data o ON b.id = o.business_id
  LEFT JOIN counts c ON b.id = c.business_id
  LEFT JOIN sub_data sd ON b.id = sd.business_id
  WHERE 
    (search_query IS NULL OR search_query = '' OR b.name ILIKE '%' || search_query || '%' OR o.phone ILIKE '%' || search_query || '%')
    AND (filter_status IS NULL OR filter_status = '' OR b.status::text = filter_status)
    AND (filter_plan IS NULL OR filter_plan = '' OR sd.plan_name ILIKE filter_plan)
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 3. DETAIL VIEW RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_platform_business_detail(p_business_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  SELECT json_build_object(
    'business', (SELECT row_to_json(b) FROM public.businesses b WHERE b.id = p_business_id),
    'owner', (
      SELECT json_build_object('id', au.id, 'email', au.email, 'phone', au.raw_user_meta_data->>'phone')
      FROM public.business_members bm
      JOIN auth.users au ON bm.user_id = au.id
      WHERE bm.business_id = p_business_id AND bm.role = 'owner'
      LIMIT 1
    ),
    'metrics', (
      SELECT json_build_object(
        'user_count', (SELECT count(*) FROM public.business_members WHERE business_id = p_business_id),
        'branch_count', (SELECT count(*) FROM public.branches WHERE business_id = p_business_id),
        'total_transactions', (SELECT count(*) FROM public.transactions WHERE business_id = p_business_id),
        'total_inventory', (SELECT count(*) FROM public.products WHERE business_id = p_business_id)
      )
    ),
    'subscription', (
      SELECT row_to_json(s) 
      FROM (
        SELECT sub.*, p.name as plan_name, p.price_monthly, p.price_annual
        FROM public.subscriptions sub
        JOIN public.plans p ON sub.plan_id = p.id
        WHERE sub.business_id = p_business_id
        ORDER BY sub.created_at DESC LIMIT 1
      ) s
    ),
    'usage_this_month', (
      SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
      FROM public.usage_records u
      WHERE u.business_id = p_business_id AND u.period_start >= date_trunc('month', now())
    ),
    'recent_audits', (
      SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
      FROM (
        SELECT al.action, al.entity_type, al.created_at, au.email as user_email
        FROM public.audit_logs al
        LEFT JOIN auth.users au ON al.user_id = au.id
        WHERE al.business_id = p_business_id
        ORDER BY al.created_at DESC
        LIMIT 10
      ) a
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 4. ACTION RPCS
-- ==========================================

-- Helper to log platform actions
CREATE OR REPLACE FUNCTION public.log_platform_action(
  p_business_id uuid,
  p_action text,
  p_details jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.audit_logs (business_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_business_id, 
    auth.uid(), 
    p_action, 
    'platform_action', 
    p_business_id, -- Using business_id as entity_id for platform actions
    p_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suspend Business
CREATE OR REPLACE FUNCTION public.suspend_business(p_business_id uuid, p_reason text DEFAULT '')
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  UPDATE public.businesses SET status = 'suspended', updated_at = now() WHERE id = p_business_id;
  PERFORM public.log_platform_action(p_business_id, 'SUSPEND_BUSINESS', jsonb_build_object('reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reactivate Business
CREATE OR REPLACE FUNCTION public.reactivate_business(p_business_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  UPDATE public.businesses SET status = 'active', updated_at = now() WHERE id = p_business_id;
  PERFORM public.log_platform_action(p_business_id, 'REACTIVATE_BUSINESS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft Delete Business
CREATE OR REPLACE FUNCTION public.soft_delete_business(p_business_id uuid, p_reason text DEFAULT '')
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  UPDATE public.businesses SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = p_business_id;
  PERFORM public.log_platform_action(p_business_id, 'DELETE_BUSINESS', jsonb_build_object('reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
