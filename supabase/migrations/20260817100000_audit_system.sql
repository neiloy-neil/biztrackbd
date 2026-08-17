-- Migration: Comprehensive Audit System

-- ==========================================
-- 1. RENAME EXISTING AUDIT TABLE
-- ==========================================
ALTER TABLE public.audit_logs RENAME TO business_audit_logs;

-- Add IP and User Agent to business_audit_logs
ALTER TABLE public.business_audit_logs 
ADD COLUMN ip_address inet,
ADD COLUMN user_agent text;

-- Rename foreign key constraints if needed (Supabase usually handles name resolution, but for clarity)
-- Note: We'll leave existing constraints as-is unless they conflict.

-- ==========================================
-- 2. CREATE PLATFORM AUDIT LOGS
-- ==========================================
CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL, -- e.g., 'business', 'user', 'coupon', 'subscription', 'system'
  target_id text, -- stored as text to accommodate different ID types
  old_state jsonb,
  new_state jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. ROW LEVEL SECURITY (APPEND-ONLY)
-- ==========================================
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform Admins can view logs
CREATE POLICY "Admins view platform audit logs" 
ON public.platform_audit_logs FOR SELECT 
USING (public.is_platform_admin());

-- Notice: We do NOT create UPDATE or DELETE policies.
-- By default, this denies UPDATE and DELETE via API.

-- ==========================================
-- 4. DATABASE-LEVEL TAMPER PREVENTION
-- ==========================================
-- Even Service Role / Super Admin shouldn't easily delete these without dropping the trigger.
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_business_audit_update_delete
BEFORE UPDATE OR DELETE ON public.business_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_tampering();

CREATE TRIGGER trg_prevent_platform_audit_update_delete
BEFORE UPDATE OR DELETE ON public.platform_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_tampering();

-- ==========================================
-- 5. LOGIN TRACKING TRIGGER
-- ==========================================
-- Tracks when a user logs in (last_sign_in_at changes)
CREATE OR REPLACE FUNCTION log_user_login()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
    INSERT INTO public.platform_audit_logs (actor_id, action, target_type, target_id, new_state)
    VALUES (NEW.id, 'login', 'user', NEW.id::text, jsonb_build_object('last_sign_in_at', NEW.last_sign_in_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (requires superuser, but Supabase allows triggers on auth.users)
CREATE TRIGGER trg_log_user_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION log_user_login();
