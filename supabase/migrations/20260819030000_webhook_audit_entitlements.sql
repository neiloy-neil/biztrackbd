-- Enhance Webhook with Audit Trail and explicit Entitlement tracking

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

    -- Activation and Entitlement
    v_new_period_end := COALESCE(v_sub.current_period_end, now()) + INTERVAL '1 month';

    UPDATE public.subscriptions
       SET status               = 'active',
           current_period_start = COALESCE(v_sub.current_period_end, now()),
           current_period_end   = v_new_period_end,
           updated_at           = now()
     WHERE id = v_sub.id;

    -- Update checkout session
    UPDATE public.checkout_sessions
       SET status = 'paid', updated_at = now()
     WHERE invoice_id = v_invoice.id;

    -- 1. Record Audit Log
    INSERT INTO public.platform_audit_logs (action, target_type, target_id, new_state)
    VALUES (
      'subscription_payment_success', 
      'subscription', 
      v_sub.id::text, 
      jsonb_build_object(
        'invoice_id', v_invoice.id,
        'amount_paid', p_amount,
        'new_period_end', v_new_period_end
      )
    );

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_processed', 'new_period_end', v_new_period_end);
  ELSIF p_status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN
    UPDATE public.invoices SET status = 'void', updated_at = now() WHERE id = v_invoice.id;
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now() WHERE id = v_sub.id;
    
    -- Update checkout session
    UPDATE public.checkout_sessions
       SET status = 'failed', updated_at = now()
     WHERE invoice_id = v_invoice.id;
     
    -- Audit Failure
    INSERT INTO public.platform_audit_logs (action, target_type, target_id, new_state)
    VALUES (
      'subscription_payment_failed', 
      'subscription', 
      v_sub.id::text, 
      jsonb_build_object('invoice_id', v_invoice.id, 'provider_status', p_status)
    );

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'status_ignored', 'status', p_status);
END;
$$;
