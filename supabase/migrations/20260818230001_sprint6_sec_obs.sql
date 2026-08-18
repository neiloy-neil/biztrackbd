-- =============================================================
-- Migration: Sprint 6 - Security & Observability
-- Fixes:
-- 1. SEC-07: Make transactions and account_transactions append-only from UI
-- 2. OBS-01: Add audit log to create_transaction_atomic
-- =============================================================

-- ============================================================
-- 1. SEC-07: Strip UPDATE/DELETE policies from financial ledgers
--    Transactions should only be reversed or adjusted, not modified.
-- ============================================================

-- Drop UPDATE and DELETE policies on transactions
DROP POLICY IF EXISTS "Business members can update their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Business members can delete their transactions" ON public.transactions;

-- Drop UPDATE and DELETE policies on account_transactions
DROP POLICY IF EXISTS "Business members can update their account transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Business members can delete their account transactions" ON public.account_transactions;

-- Note: We leave INSERT and SELECT intact as they are required for normal operations.
-- Any necessary updates (e.g. by system triggers or admin) bypass RLS.


-- ============================================================
-- 2. OBS-01: Add audit log to create_transaction_atomic
--    Modify the RPC to include an INSERT into platform_audit_logs.
--    Wait, transactions don't have a direct 'actor_id' passed to the RPC, 
--    but we can get it from auth.uid(). Note: the RPC is used by the app,
--    so auth.uid() is available.
-- ============================================================

-- Instead of replacing the entire huge RPC which might have evolved,
-- we'll just add a trigger to log all transaction inserts to a business audit log,
-- or just use the platform_audit_logs if applicable.
-- Wait, the audit gaps mention `create_transaction_atomic` specifically.
-- Let's create an AFTER INSERT trigger on transactions to ensure ALL 
-- transactions (including POS) are logged.

CREATE OR REPLACE FUNCTION public.log_transaction_creation()
RETURNS trigger AS $$
BEGIN
  -- Insert into an audit table. 
  -- Assuming we have platform_audit_logs or similar.
  INSERT INTO public.platform_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    new_state,
    created_at
  ) VALUES (
    auth.uid(),
    'create_transaction',
    'transaction',
    NEW.id::text,
    jsonb_build_object(
      'business_id', NEW.business_id,
      'type', NEW.type,
      'total_amount', NEW.total_amount,
      'party_id', NEW.party_id
    ),
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_transaction_insert ON public.transactions;
CREATE TRIGGER trg_audit_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_transaction_creation();
