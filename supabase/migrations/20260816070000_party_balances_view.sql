-- Migration: Add opening_balance to parties and create v_party_balances view

-- 1. Add opening_balance column to parties
ALTER TABLE public.parties ADD COLUMN opening_balance numeric(19,4) DEFAULT 0 NOT NULL;

-- 2. Create the View to calculate real-time balances securely
-- For customers: Balance = opening_balance + sales - payment_in (Positive = They owe us)
-- For suppliers: Balance = opening_balance + purchases - payment_out (Positive = We owe them)
CREATE OR REPLACE VIEW public.v_party_balances AS
SELECT 
  p.id,
  p.business_id,
  p.type,
  p.name,
  p.phone,
  p.email,
  p.address,
  p.created_at,
  p.opening_balance,
  p.opening_balance + COALESCE(
    SUM(
      CASE 
        WHEN p.type = 'customer' THEN
          CASE 
            WHEN t.type = 'sale' THEN t.total_amount
            WHEN t.type = 'payment_in' THEN -t.total_amount
            ELSE 0
          END
        WHEN p.type = 'supplier' THEN
          CASE
            WHEN t.type = 'purchase' THEN t.total_amount
            WHEN t.type = 'payment_out' THEN -t.total_amount
            ELSE 0
          END
        ELSE 0
      END
    )
  , 0) as current_due
FROM public.parties p
LEFT JOIN public.transactions t 
  ON p.id = t.party_id 
  AND t.state = 'completed'
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- 3. Security (View permissions)
-- Postgres views bypass RLS of the underlying tables unless created with security_invoker = true
-- Alternatively, we can just grant select to authenticated users and let the API layer filter by business_id.
-- Since Supabase is on PG15+, we can use security_invoker.
ALTER VIEW public.v_party_balances SET (security_invoker = on);

-- Grant select
GRANT SELECT ON public.v_party_balances TO authenticated;
GRANT SELECT ON public.v_party_balances TO service_role;
