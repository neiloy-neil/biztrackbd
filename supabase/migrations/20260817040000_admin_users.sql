-- Migration: Admin User Management RPCs
-- Provides optimized queries and actions for the Super Admin user dashboard

-- ==========================================
-- 1. LIST VIEW RPC
-- ==========================================
-- Returns an aggregated list of users with their business associations and status
CREATE OR REPLACE FUNCTION public.get_platform_users_list(
  search_query text DEFAULT NULL,
  filter_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email varchar(255),
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  business_count bigint,
  status text
) AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  RETURN QUERY
  WITH user_biz_counts AS (
    SELECT user_id, count(*) as b_count
    FROM public.business_members
    GROUP BY user_id
  )
  SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'phone' as phone,
    au.created_at,
    au.last_sign_in_at,
    au.banned_until,
    COALESCE(ubc.b_count, 0) as business_count,
    CASE 
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'suspended'
      WHEN au.last_sign_in_at IS NULL THEN 'unverified'
      WHEN au.last_sign_in_at < now() - interval '90 days' THEN 'inactive'
      ELSE 'active'
    END as status
  FROM auth.users au
  LEFT JOIN user_biz_counts ubc ON au.id = ubc.user_id
  WHERE 
    (search_query IS NULL OR search_query = '' OR au.email ILIKE '%' || search_query || '%' OR (au.raw_user_meta_data->>'phone') ILIKE '%' || search_query || '%')
    AND (
      filter_status IS NULL OR filter_status = '' OR 
      (filter_status = 'suspended' AND au.banned_until IS NOT NULL AND au.banned_until > now()) OR
      (filter_status = 'active' AND (au.banned_until IS NULL OR au.banned_until <= now()) AND au.last_sign_in_at >= now() - interval '90 days') OR
      (filter_status = 'inactive' AND (au.banned_until IS NULL OR au.banned_until <= now()) AND au.last_sign_in_at < now() - interval '90 days') OR
      (filter_status = 'unverified' AND au.last_sign_in_at IS NULL)
    )
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. DETAIL VIEW RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_platform_user_detail(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  SELECT json_build_object(
    'user', (
      SELECT json_build_object(
        'id', au.id,
        'email', au.email,
        'phone', au.raw_user_meta_data->>'phone',
        'created_at', au.created_at,
        'last_sign_in_at', au.last_sign_in_at,
        'banned_until', au.banned_until,
        'app_metadata', au.raw_app_meta_data,
        'status', CASE 
          WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'suspended'
          WHEN au.last_sign_in_at IS NULL THEN 'unverified'
          WHEN au.last_sign_in_at < now() - interval '90 days' THEN 'inactive'
          ELSE 'active'
        END
      )
      FROM auth.users au WHERE au.id = p_user_id
    ),
    'businesses', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'business_id', b.id,
          'business_name', b.name,
          'role', bm.role,
          'joined_at', bm.created_at,
          'status', b.status
        )
      ), '[]'::json)
      FROM public.business_members bm
      JOIN public.businesses b ON bm.business_id = b.id
      WHERE bm.user_id = p_user_id
    ),
    'recent_audits', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'action', al.action,
          'entity_type', al.entity_type,
          'created_at', al.created_at
        )
      ), '[]'::json)
      FROM (
        SELECT action, entity_type, created_at 
        FROM public.audit_logs 
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 10
      ) al
    ),
    'sessions', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', s.id,
          'created_at', s.created_at,
          'not_after', s.not_after
        )
      ), '[]'::json)
      FROM auth.sessions s
      WHERE s.user_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 3. ACTION RPCS
-- ==========================================

-- Suspend User
CREATE OR REPLACE FUNCTION public.suspend_user(p_user_id uuid, p_reason text DEFAULT '')
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = p_user_id;
  
  -- Also force logout the user by destroying sessions
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id) OR parent IN (SELECT token FROM auth.refresh_tokens WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id));
  -- Since we just deleted sessions, refresh tokens might be cascading, but just in case:
  -- Actually, auth.refresh_tokens has a foreign key to auth.sessions with ON DELETE CASCADE in most setups. 
  -- We just delete sessions.
  
  PERFORM public.log_platform_action(p_user_id, 'SUSPEND_USER', jsonb_build_object('reason', p_reason, 'target_user_id', p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reactivate User
CREATE OR REPLACE FUNCTION public.reactivate_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  PERFORM public.log_platform_action(p_user_id, 'REACTIVATE_USER', jsonb_build_object('target_user_id', p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force Logout User
CREATE OR REPLACE FUNCTION public.force_logout_user(p_user_id uuid, p_reason text DEFAULT '')
RETURNS void AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  
  PERFORM public.log_platform_action(p_user_id, 'FORCE_LOGOUT_USER', jsonb_build_object('reason', p_reason, 'target_user_id', p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
