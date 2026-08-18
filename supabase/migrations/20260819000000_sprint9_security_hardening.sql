-- =============================================================
-- Migration: Sprint 9 Core Security Hardening (P0)
-- Description: Tenant isolation IDOR fixes, Immutable ledger enforcement, 
-- webhook security, and server-side POS cart validation.
-- =============================================================

-- ── 1. Tenant Isolation Breakdown (IDOR) Fix ──────────────────────
-- Rewrite is_business_member to use JWT claim caching to prevent nested loop crashes
CREATE OR REPLACE FUNCTION public.is_business_member(biz_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  jwt_biz_id uuid;
BEGIN
  -- Attempt to extract business_id from JWT app_metadata or user_metadata
  BEGIN
    jwt_biz_id := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'business_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    jwt_biz_id := NULL;
  END;

  IF jwt_biz_id IS NULL THEN
    BEGIN
      jwt_biz_id := (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'business_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      jwt_biz_id := NULL;
    END;
  END IF;

  IF jwt_biz_id IS NOT NULL THEN
    RETURN jwt_biz_id = biz_id;
  END IF;

  -- Fallback to table lookup for internal/service calls where JWT is not available
  RETURN EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = biz_id
      AND user_id = auth.uid()
  );
END;
$$;


-- ── 2. Immutable Ledger Enforcement ──────────────────────────────
-- Drop all UPDATE and DELETE policies for transactions and account_transactions
DROP POLICY IF EXISTS "RBAC UPDATE transactions" ON public.transactions;
DROP POLICY IF EXISTS "RBAC DELETE transactions" ON public.transactions;

DROP POLICY IF EXISTS "RBAC UPDATE account_transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "RBAC DELETE account_transactions" ON public.account_transactions;

DROP POLICY IF EXISTS "Tenant isolation UPDATE transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation DELETE transactions" ON public.transactions;

DROP POLICY IF EXISTS "Tenant isolation UPDATE account_transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Tenant isolation DELETE account_transactions" ON public.account_transactions;


-- Create the append-only voiding RPC
CREATE OR REPLACE FUNCTION public.void_transaction(
  p_transaction_id UUID,
  p_reason TEXT
) RETURNS boolean AS $$
DECLARE
  v_transaction RECORD;
  v_item RECORD;
  v_acc_txn RECORD;
  v_void_tx_id UUID;
BEGIN
  SELECT * INTO v_transaction FROM public.transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.state = 'voided' THEN
    RAISE EXCEPTION 'Transaction is already voided';
  END IF;

  IF NOT public.is_business_member(v_transaction.business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Mark original as voided
  UPDATE public.transactions 
  SET state = 'voided', notes = CONCAT(notes, ' | Voided: ', p_reason)
  WHERE id = p_transaction_id;

  -- Create offsetting transaction
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    v_transaction.business_id, v_transaction.branch_id, v_transaction.party_id, 'sale_return', 'completed',
    -v_transaction.total_amount, -v_transaction.subtotal, -v_transaction.discount, p_reason, auth.uid()
  ) RETURNING id INTO v_void_tx_id;

  -- Reverse account transactions
  FOR v_acc_txn IN SELECT * FROM public.account_transactions WHERE transaction_id = p_transaction_id LOOP
    INSERT INTO public.account_transactions (
      transaction_id, account_id, amount
    ) VALUES (
      v_void_tx_id, v_acc_txn.account_id, -v_acc_txn.amount
    );
  END LOOP;

  -- Reverse inventory movements
  FOR v_item IN SELECT * FROM public.inventory_movements WHERE transaction_id = p_transaction_id LOOP
    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      v_transaction.business_id, v_transaction.branch_id, v_item.product_id, v_void_tx_id, 
      CASE WHEN v_item.type = 'in' THEN 'out'::text WHEN v_item.type = 'out' THEN 'in'::text ELSE v_item.type END,
      v_item.quantity, auth.uid()
    );
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. Subscription Webhook Security ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  idempotency_key text PRIMARY KEY,
  processed_at timestamptz DEFAULT now()
);

-- Note: We add parameters for idempotency and secret verification.
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

    RETURN jsonb_build_object('ok', true, 'reason', 'payment_processed', 'new_period_end', v_new_period_end);
  ELSIF p_status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN
    UPDATE public.invoices SET status = 'void', updated_at = now() WHERE id = v_invoice.id;
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now() WHERE id = v_sub.id;
    RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'status_ignored', 'status', p_status);
END;
$$;


-- ── 4. Server-Side Cart Validation (POS) ──────────────────────────
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id UUID,
  p_branch_id UUID,
  p_party_id UUID, 
  p_total_amount NUMERIC, -- Kept for interface compatibility, but ignored
  p_subtotal NUMERIC,     -- Kept for interface compatibility, but ignored
  p_discount NUMERIC,
  p_notes TEXT,
  p_user_id UUID,
  p_items JSONB, 
  p_payments JSONB 
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item RECORD;
  v_payment RECORD;
  v_calc_subtotal NUMERIC := 0;
  v_calc_total NUMERIC := 0;
  v_db_price NUMERIC;
BEGIN
  IF p_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  -- 1. Server-side price calculation
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC) LOOP
    SELECT price INTO v_db_price FROM public.products 
    WHERE id = v_item.product_id AND business_id = p_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or does not belong to business', v_item.product_id;
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_db_price * v_item.quantity);
  END LOOP;

  v_calc_total := v_calc_subtotal - p_discount;

  -- 2. Insert transaction using calculated totals
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, 
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    v_calc_total, v_calc_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- 3. Process items using database prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC) LOOP
    SELECT price INTO v_db_price FROM public.products WHERE id = v_item.product_id;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_db_price, (v_db_price * v_item.quantity)
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id, 'out', v_item.quantity, p_user_id
    );
  END LOOP;

  -- 4. Process payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC) LOOP
    IF v_payment.amount > 0 THEN
      INSERT INTO public.account_transactions (
        transaction_id, account_id, amount
      ) VALUES (
        v_transaction_id, v_payment.account_id, v_payment.amount
      );
    END IF;
  END LOOP;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
