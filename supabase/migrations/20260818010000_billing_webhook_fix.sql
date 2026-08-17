-- =============================================================
-- Migration: Billing Webhook Fix
-- Replaces process_payment_webhook to use internal invoice UUID
-- and properly handle idempotency & lifecycle.
-- =============================================================

-- Drop the old function first since we are changing the parameter types
DROP FUNCTION IF EXISTS public.process_payment_webhook(text, text, numeric);

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_internal_invoice_id uuid,
  p_gateway_event_id    text,
  p_status              text,
  p_amount              numeric DEFAULT 0
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
BEGIN
  -- Lock the invoice row to prevent concurrent webhook processing
  SELECT * INTO v_invoice
    FROM public.invoices
   WHERE id = p_internal_invoice_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_found');
  END IF;

  -- Idempotency: already processed — safe to acknowledge again
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_processed');
  END IF;

  SELECT * INTO v_sub
    FROM public.subscriptions
   WHERE id = v_invoice.subscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_not_found');
  END IF;

  -- ── COMPLETED payment ────────────────────────────────────────
  IF p_status = 'COMPLETED' THEN
    UPDATE public.invoices
       SET status                = 'paid',
           amount_paid           = p_amount,
           paid_date             = now(),
           uddoktapay_invoice_id = p_gateway_event_id,
           updated_at            = now()
     WHERE id = v_invoice.id;

    -- Advance the billing period by 1 month from where it ended
    v_new_period_end := v_sub.current_period_end + INTERVAL '1 month';

    UPDATE public.subscriptions
       SET status               = 'active',
           current_period_start = v_sub.current_period_end,
           current_period_end   = v_new_period_end,
           updated_at           = now()
     WHERE id = v_sub.id;

    RETURN jsonb_build_object(
      'ok',             true,
      'reason',         'payment_processed',
      'new_period_end', v_new_period_end
    );

  -- ── Failed / cancelled / expired payment ────────────────────
  ELSIF p_status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN
    UPDATE public.invoices
       SET status                = 'void',
           uddoktapay_invoice_id = p_gateway_event_id,
           updated_at            = now()
     WHERE id = v_invoice.id;

    -- DO NOT automatically suspend the subscription here.
    -- The user may have just abandoned a checkout page.
    -- The daily cron job will handle marking it past_due if the due date is reached.

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');

  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_status');
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    -- If another process somehow sets uddoktapay_invoice_id simultaneously
    RETURN jsonb_build_object('ok', true, 'reason', 'already_processed_unique');
END;
$$;
