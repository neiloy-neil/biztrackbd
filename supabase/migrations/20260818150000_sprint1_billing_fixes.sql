-- =============================================================
-- Migration: Sprint 1 - Billing & Security Fixes
-- Fixes:
-- 1. SEC-02: REVOKE process_payment_webhook from public
-- 2. FIN-04: Add plan_id to invoices
-- =============================================================

-- 1. Revoke public execution of the payment webhook RPC
-- Signature changed in 20260818010000_billing_webhook_fix.sql to (uuid, text, text, numeric)
REVOKE ALL ON FUNCTION public.process_payment_webhook(uuid, text, text, numeric) FROM public, anon, authenticated;

-- 2. Add plan_id to invoices table so plan upgrades persist correctly
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;
