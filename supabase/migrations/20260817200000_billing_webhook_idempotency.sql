-- =============================================================
-- Migration: Billing Webhook Idempotency & Atomicity (P1-C)
--
-- Problems fixed:
--   1. No unique constraint on uddoktapay_invoice_id — concurrent
--      or replayed webhooks process the same payment twice.
--   2. Invoice + subscription updates were separate queries;
--      a crash between them leaves billing state inconsistent.
--   3. current_period_end was never advanced on payment, so the
--      cron immediately re-queued the subscription as overdue.
--   4. amount_paid and paid_date were never written on payment.
--
-- Fix:
--   - Unique partial index on uddoktapay_invoice_id (null-safe).
--   - process_payment_webhook() RPC executes invoice + subscription
--     update atomically and is idempotent via row-level FOR UPDATE.
-- =============================================================

-- ── 1. Idempotency index ──────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS invoices_uddoktapay_invoice_id_key
  ON public.invoices (uddoktapay_invoice_id)
  WHERE uddoktapay_invoice_id IS NOT NULL;

-- ── 2. Atomic payment processor ──────────────────────────────
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_uddoktapay_invoice_id text,
  p_status                text,
  p_amount                numeric DEFAULT 0
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
   WHERE uddoktapay_invoice_id = p_uddoktapay_invoice_id
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
       SET status      = 'paid',
           amount_paid = p_amount,
           paid_date   = now(),
           updated_at  = now()
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
       SET status     = 'void',
           updated_at = now()
     WHERE id = v_invoice.id;

    UPDATE public.subscriptions
       SET status     = 'past_due',
           updated_at = now()
     WHERE id = v_sub.id;

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');
  END IF;

  -- Unknown status — acknowledge so UddoktaPay stops retrying
  RETURN jsonb_build_object('ok', true, 'reason', 'status_ignored', 'status', p_status);
END;
$$;
