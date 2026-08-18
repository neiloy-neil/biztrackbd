-- Migration: Subscription Renewals
-- Adds billing_cycle to subscriptions, dynamic webhook extensions, and renewal cron.

-- 1. Add billing_cycle to subscriptions
ALTER TABLE public.subscriptions
ADD COLUMN billing_cycle text DEFAULT 'monthly' NOT NULL CHECK (billing_cycle IN ('monthly', 'annual'));

-- 2. Update process_payment_webhook to handle dynamic periods
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
  v_checkout     record;
  v_new_period_end timestamptz;
  v_stored_secret text;
  v_billing_cycle text;
BEGIN
  -- Defense-in-depth secret check
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

  -- Find associated checkout session to sync billing cycle
  SELECT * INTO v_checkout
    FROM public.checkout_sessions
   WHERE invoice_id = v_invoice.id
   ORDER BY created_at DESC LIMIT 1;

  IF p_status = 'COMPLETED' THEN
    UPDATE public.invoices
       SET status      = 'paid',
           amount_paid = p_amount,
           paid_date   = now(),
           updated_at  = now()
     WHERE id = v_invoice.id;

    -- Determine billing cycle (fallback to subscription if no checkout found, or monthly)
    v_billing_cycle := COALESCE(v_checkout.billing_cycle, v_sub.billing_cycle, 'monthly');

    -- Calculate new period end.
    -- If it was past due or lapsed by more than a month, we start from now.
    IF v_sub.current_period_end IS NULL OR v_sub.current_period_end < now() - interval '1 month' THEN
      v_new_period_end := now() + CASE WHEN v_billing_cycle = 'annual' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
    ELSE
      v_new_period_end := v_sub.current_period_end + CASE WHEN v_billing_cycle = 'annual' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
    END IF;

    UPDATE public.subscriptions
       SET status               = 'active',
           billing_cycle        = v_billing_cycle,
           current_period_start = CASE WHEN v_sub.current_period_end IS NULL OR v_sub.current_period_end < now() - interval '1 month' THEN now() ELSE v_sub.current_period_end END,
           current_period_end   = v_new_period_end,
           updated_at           = now()
     WHERE id = v_sub.id;

    -- Update checkout session
    IF v_checkout IS NOT NULL THEN
      UPDATE public.checkout_sessions
         SET status = 'paid', updated_at = now()
       WHERE id = v_checkout.id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_processed', 'new_period_end', v_new_period_end);
  ELSIF p_status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN
    UPDATE public.invoices SET status = 'void', updated_at = now() WHERE id = v_invoice.id;
    
    -- Update checkout session
    IF v_checkout IS NOT NULL THEN
      UPDATE public.checkout_sessions
         SET status = 'failed', updated_at = now()
       WHERE id = v_checkout.id;
    END IF;
     
    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'status_ignored', 'status', p_status);
END;
$$;

-- 3. process_subscription_renewals cron RPC
CREATE OR REPLACE FUNCTION public.process_subscription_renewals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub record;
  v_plan record;
  v_amount numeric;
  v_count_invoices integer := 0;
  v_count_past_due integer := 0;
  v_count_unpaid integer := 0;
BEGIN
  -- 1. Create renewal invoices for active subscriptions expiring in <= 7 days
  FOR v_sub IN 
    SELECT s.* 
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND s.current_period_end <= now() + interval '7 days'
      AND NOT EXISTS (
        -- Do not create if there is already an open/draft invoice for this subscription
        SELECT 1 FROM public.invoices i 
        WHERE i.subscription_id = s.id 
          AND i.status IN ('draft', 'open')
      )
  LOOP
    -- Get plan details
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    
    IF v_sub.billing_cycle = 'annual' THEN
      v_amount := v_plan.price_annual;
    ELSE
      v_amount := v_plan.price_monthly;
    END IF;

    -- Create invoice
    INSERT INTO public.invoices (
      business_id, subscription_id, amount_due, status, due_date
    ) VALUES (
      v_sub.business_id, v_sub.id, v_amount, 'open', v_sub.current_period_end
    );
    
    v_count_invoices := v_count_invoices + 1;
  END LOOP;

  -- 2. Transition active -> past_due for lapsed subscriptions
  WITH updated AS (
    UPDATE public.subscriptions
    SET status = 'past_due', updated_at = now()
    WHERE status = 'active' AND current_period_end < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count_past_due FROM updated;

  -- 3. Transition past_due -> unpaid (suspend) after 7-day grace period
  WITH updated AS (
    UPDATE public.subscriptions
    SET status = 'unpaid', updated_at = now()
    WHERE status = 'past_due' AND current_period_end < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO v_count_unpaid FROM updated;

  RETURN jsonb_build_object(
    'ok', true, 
    'invoices_created', v_count_invoices,
    'marked_past_due', v_count_past_due,
    'marked_unpaid', v_count_unpaid
  );
END;
$$;
