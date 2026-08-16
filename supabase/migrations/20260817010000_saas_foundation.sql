-- Migration: SaaS Foundation
-- Includes: Platform Admins, Plans, Subscriptions, Usage Tracking, and Invoices.

-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE public.subscription_status AS ENUM (
  'trialing', 
  'active', 
  'past_due', 
  'canceled', 
  'unpaid'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'open',
  'paid',
  'void',
  'uncollectible'
);

CREATE TYPE public.platform_role AS ENUM (
  'super_admin',
  'support',
  'billing'
);

-- ==========================================
-- 2. PLATFORM LAYER
-- ==========================================
-- Identifies users who have platform-wide permissions.
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role public.platform_role DEFAULT 'support' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- SaaS Plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric(19,4) NOT NULL DEFAULT 0,
  price_annual numeric(19,4) NOT NULL DEFAULT 0,
  currency text DEFAULT 'BDT' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Plan Features (Defines entitlements for a plan)
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL, -- e.g., 'multi_branch', 'transactions', 'inventory'
  limit_value integer, -- NULL means unlimited, 0 means false/disabled, >0 means count
  UNIQUE(plan_id, feature_key)
);

-- ==========================================
-- 3. TENANT SUBSCRIPTIONS
-- ==========================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE RESTRICT NOT NULL,
  status public.subscription_status DEFAULT 'trialing' NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 4. USAGE TRACKING
-- ==========================================
-- Tracks usage per feature per billing period
CREATE TABLE public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  UNIQUE(business_id, feature_key, period_start)
);

-- ==========================================
-- 5. INVOICES
-- ==========================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_due numeric(19,4) NOT NULL,
  amount_paid numeric(19,4) DEFAULT 0 NOT NULL,
  status public.invoice_status DEFAULT 'draft' NOT NULL,
  uddoktapay_invoice_id text, -- To track remote gateway ID
  payment_url text,
  due_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 6. AUTHORIZATION FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. RLS POLICIES
-- ==========================================
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Platform Admins (Only visible to other admins)
CREATE POLICY "Admins view admins" ON public.platform_admins FOR SELECT USING (public.is_platform_admin());

-- Plans & Features (Publicly readable for pricing pages)
CREATE POLICY "Anyone views active plans" ON public.plans FOR SELECT USING (is_active = true OR public.is_platform_admin());
CREATE POLICY "Anyone views plan features" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.is_platform_admin());
CREATE POLICY "Admins manage plan features" ON public.plan_features FOR ALL USING (public.is_platform_admin());

-- Subscriptions (Tenant sees own, Admin sees all)
CREATE POLICY "Tenant isolation SELECT subscriptions" ON public.subscriptions FOR SELECT USING (public.is_business_member(business_id) OR public.is_platform_admin());
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL USING (public.is_platform_admin());

-- Usage Records (Tenant sees own, Admin sees all)
CREATE POLICY "Tenant isolation SELECT usage_records" ON public.usage_records FOR SELECT USING (public.is_business_member(business_id) OR public.is_platform_admin());

-- Invoices (Tenant sees own, Admin sees all)
CREATE POLICY "Tenant isolation SELECT invoices" ON public.invoices FOR SELECT USING (public.is_business_member(business_id) OR public.is_platform_admin());

-- ==========================================
-- 8. TRIGGERS FOR USAGE TRACKING
-- ==========================================
-- Example trigger to automatically increment usage for "transactions"
CREATE OR REPLACE FUNCTION public.increment_transaction_usage()
RETURNS trigger AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_limit integer;
BEGIN
  -- Get current subscription period
  SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
  FROM public.subscriptions
  WHERE business_id = NEW.business_id AND status = 'active';

  -- If no active subscription, we might block or allow depending on business rules.
  -- For now, if no subscription, we assume it's free/trial and track it anyway using current month.
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end := date_trunc('month', now()) + interval '1 month';
  END IF;

  -- Upsert usage record
  INSERT INTO public.usage_records (business_id, feature_key, usage_count, period_start, period_end)
  VALUES (NEW.business_id, 'transactions', 1, v_period_start, v_period_end)
  ON CONFLICT (business_id, feature_key, period_start)
  DO UPDATE SET usage_count = public.usage_records.usage_count + 1;

  -- ENFORCEMENT: Check if they exceeded their limit (optional strict mode)
  -- If we want strict enforcement, we fetch the limit here and RAISE EXCEPTION if exceeded.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_track_transaction_usage
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.increment_transaction_usage();
