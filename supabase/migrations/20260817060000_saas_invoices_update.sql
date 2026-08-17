-- Migration: SaaS Invoices Update
-- Adds missing fields to invoices and updates the status enum

-- 1. Update Invoice Status Enum
-- We need to add 'past_due' and 'refunded'. Existing statuses are: 'draft', 'open', 'paid', 'void', 'uncollectible'.
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'refunded';

-- 2. Alter Invoices Table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS billing_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS paid_date timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text;
