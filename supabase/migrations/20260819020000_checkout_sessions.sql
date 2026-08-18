-- =============================================================
-- Migration: SaaS Checkout Sessions
-- Description: Server-authoritative checkout tracking.
-- =============================================================

CREATE TYPE public.checkout_session_status AS ENUM (
  'pending',
  'payment_started',
  'paid',
  'failed',
  'cancelled',
  'expired'
);

CREATE TABLE public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE RESTRICT NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  base_amount numeric(19,4) NOT NULL DEFAULT 0,
  discount_amount numeric(19,4) NOT NULL DEFAULT 0,
  tax_amount numeric(19,4) NOT NULL DEFAULT 0,
  final_amount numeric(19,4) NOT NULL DEFAULT 0,
  currency text DEFAULT 'BDT' NOT NULL,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_provider text DEFAULT 'uddoktapay' NOT NULL,
  provider_session_id text,
  status public.checkout_session_status DEFAULT 'pending' NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checkout sessions" 
ON public.checkout_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage checkout sessions"
ON public.checkout_sessions FOR ALL
USING (public.is_platform_admin());

-- Modify `process_payment_webhook` to also update the checkout_session
-- We will replace the existing function from 20260818010000_billing_webhook_fix.sql
-- with one that also updates checkout_sessions if there is a matching invoice_id.

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_uddoktapay_invoice_id text,
  p_status                text,
  p_amount                numeric DEFAULT 0,
  p_idempotency_key       text DEFAULT NULL,
  p_webhook_secret        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice      record;
  v_sub          record;
  v_new_period_end timestamptz;
  v_stored_secret text;
BEGIN
  -- Defense-in-depth secret check (optional, but highly recommended)
  BEGIN
    v_stored_secret := current_setting('app.webhook_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_stored_secret := NULL;
  END;

  IF v_stored_secret IS NOT NULL AND v_stored_secret != '' AND (p_webhook_secret IS NULL OR p_webhook_secret <> v_stored_secret) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_secret');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.webhook_events WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('ok', true, 'reason', 'already_processed_idempotent');
    END IF;
    INSERT INTO public.webhook_events (idempotency_key) VALUES (p_idempotency_key);
  END IF;

  -- Lock invoice row
  SELECT * INTO v_invoice
    FROM public.invoices
   WHERE uddoktapay_invoice_id = p_uddoktapay_invoice_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_processed');
  END IF;

  SELECT * INTO v_sub
    FROM public.subscriptions
   WHERE id = v_invoice.subscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_not_found');
  END IF;

  IF p_status = 'COMPLETED' THEN
    UPDATE public.invoices
       SET status      = 'paid',
           amount_paid = p_amount,
           paid_date   = now(),
           updated_at  = now()
     WHERE id = v_invoice.id;

    v_new_period_end := v_sub.current_period_end + INTERVAL '1 month';

    UPDATE public.subscriptions
       SET status               = 'active',
           current_period_start = v_sub.current_period_end,
           current_period_end   = v_new_period_end,
           updated_at           = now()
     WHERE id = v_sub.id;

    -- Update checkout session
    UPDATE public.checkout_sessions
       SET status = 'paid', updated_at = now()
     WHERE invoice_id = v_invoice.id;

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_processed', 'new_period_end', v_new_period_end);
  ELSIF p_status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN
    UPDATE public.invoices SET status = 'void', updated_at = now() WHERE id = v_invoice.id;
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now() WHERE id = v_sub.id;
    
    -- Update checkout session
    UPDATE public.checkout_sessions
       SET status = 'failed', updated_at = now()
     WHERE invoice_id = v_invoice.id;
     
    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'status_ignored', 'status', p_status);
END;
$$;
