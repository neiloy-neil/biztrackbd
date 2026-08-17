-- =============================================================
-- Migration: Sprint 4 - Admin Plan Management & Notification Triggers
-- Fixes:
-- 1. Admin "Edit Plan" dead button — add upsert_plan_feature RPC
-- 2. MF-09: DB trigger to fire in-app notification on subscription expiry
-- 3. Admin plan edit: update_plan_pricing RPC
-- =============================================================

-- ============================================================
-- 1. RPC: upsert_plan_feature
-- Allows super admins to create or update a plan's feature limit.
-- Called from the admin billing page "Edit" button.
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_plan_feature(
  p_plan_id       uuid,
  p_feature_key   text,
  p_limit_value   integer DEFAULT NULL,
  p_hard_limit    integer DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Only service_role can call this (called from adminAction which uses service_role)
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  INSERT INTO public.plan_features (plan_id, feature_key, limit_value, hard_limit_value)
  VALUES (p_plan_id, p_feature_key, p_limit_value, p_hard_limit)
  ON CONFLICT (plan_id, feature_key)
  DO UPDATE SET
    limit_value       = EXCLUDED.limit_value,
    hard_limit_value  = EXCLUDED.hard_limit_value,
    updated_at        = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 2. RPC: update_plan_pricing
-- Allows super admins to update a plan's name, price, and description.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_plan_pricing(
  p_plan_id       uuid,
  p_name          text DEFAULT NULL,
  p_description   text DEFAULT NULL,
  p_price_monthly numeric DEFAULT NULL,
  p_is_active     boolean DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  UPDATE public.plans
  SET
    name          = COALESCE(p_name, name),
    description   = COALESCE(p_description, description),
    price_monthly = COALESCE(p_price_monthly, price_monthly),
    is_active     = COALESCE(p_is_active, is_active),
    updated_at    = now()
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. MF-09: Notification trigger on subscription expiry
-- When a subscription transitions to 'past_due' or 'canceled',
-- insert an in-app notification for the business.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_subscription_status_change()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'past_due' THEN
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT
      NEW.business_id,
      'subscription_expired',
      'আপনার সাবস্ক্রিপশন মেয়াদ শেষ হয়েছে',
      'আপনার প্ল্যান মেয়াদোত্তীর্ণ হয়েছে। পরিষেবা চালু রাখতে অনুগ্রহ করে নবায়ন করুন।'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE business_id = NEW.business_id
        AND type = 'subscription_expired'
        AND is_read = false
        AND created_at >= now() - interval '7 days'
    );
  END IF;

  IF NEW.status = 'canceled' THEN
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT
      NEW.business_id,
      'subscription_canceled',
      'সাবস্ক্রিপশন বাতিল হয়েছে',
      'আপনার সাবস্ক্রিপশন বাতিল করা হয়েছে। আপনি ফ্রি প্ল্যানে ফিরে এসেছেন।'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE business_id = NEW.business_id
        AND type = 'subscription_canceled'
        AND is_read = false
        AND created_at >= now() - interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_subscription_status ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_status
  AFTER UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_status_change();


-- ============================================================
-- 4. MF-09: Notification trigger on large outstanding due
-- Fire a notification when a party's current_due exceeds 10,000
-- and no unread notification exists for that party.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_high_outstanding_due()
RETURNS trigger AS $$
BEGIN
  -- Only fire if current_due crossed the threshold upward
  IF NEW.current_due > 10000 AND (OLD.current_due IS NULL OR OLD.current_due <= 10000) THEN
    INSERT INTO public.notifications (business_id, type, title, message, reference_id)
    SELECT
      NEW.business_id,
      'high_due',
      'বড় বাকি পাওনা: ' || NEW.name,
      NEW.name || '-এর বাকি ৳' || NEW.current_due || ' ছাড়িয়ে গেছে।',
      NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE business_id = NEW.business_id
        AND type = 'high_due'
        AND reference_id = NEW.id
        AND is_read = false
        AND created_at >= now() - interval '3 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_high_due ON public.parties;
CREATE TRIGGER trg_notify_high_due
  AFTER UPDATE OF current_due ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.notify_high_outstanding_due();


-- ============================================================
-- 5. updated_at column on plan_features (needed for upsert)
-- ============================================================
ALTER TABLE public.plan_features
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
