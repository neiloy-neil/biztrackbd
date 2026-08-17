-- Migration: Platform Notification System

-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE public.notification_type AS ENUM (
  'business_created', 
  'subscription_paid', 
  'payment_failed', 
  'subscription_cancelled', 
  'trial_expiring', 
  'high_error_rate', 
  'storage_warning', 
  'sync_failure', 
  'security_event', 
  'support_ticket', 
  'system_incident'
);

CREATE TYPE public.notification_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- ==========================================
-- 2. TABLES
-- ==========================================
CREATE TABLE public.platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.notification_type NOT NULL,
  priority public.notification_priority DEFAULT 'normal'::public.notification_priority NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_url text,
  metadata jsonb,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.notification_preferences (
  admin_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT true NOT NULL,
  muted_types public.notification_type[] DEFAULT '{}'::public.notification_type[] NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: Only platform admins can manage
CREATE POLICY "Admins manage platform notifications" ON public.platform_notifications 
FOR ALL USING (public.is_platform_admin());

-- Preferences: Admins manage their own preferences
CREATE POLICY "Admins manage own preferences" ON public.notification_preferences 
FOR ALL USING (public.is_platform_admin() AND auth.uid() = admin_id);
