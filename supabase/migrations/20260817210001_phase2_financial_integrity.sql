-- =============================================================
-- Migration: Phase 2 - Financial Integrity
-- Fixes:
-- 1. Protect the Ledger: Make transactions and account_transactions append-only (immutable).
-- 2. Enforce Double-Entry: Constraint trigger to ensure transaction total matches splits.
-- =============================================================

-- ============================================================
-- 1. Protect the Ledger (Immutability)
-- Remove any UPDATE or DELETE capabilities from the ledger tables
-- to prevent historical financial forgery.
-- ============================================================

-- Drop all UPDATE and DELETE policies for transactions
DROP POLICY IF EXISTS "Tenant isolation UPDATE transactions" ON public.transactions;
DROP POLICY IF EXISTS "RBAC UPDATE transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation DELETE transactions" ON public.transactions;
DROP POLICY IF EXISTS "RBAC DELETE transactions" ON public.transactions;

-- Drop all UPDATE and DELETE policies for account_transactions
DROP POLICY IF EXISTS "Tenant isolation UPDATE account_transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Tenant isolation DELETE account_transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "RBAC UPDATE account_transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "RBAC DELETE account_transactions" ON public.account_transactions;

-- Drop all UPDATE and DELETE policies for transaction_items
DROP POLICY IF EXISTS "Tenant isolation UPDATE transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Tenant isolation DELETE transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "RBAC UPDATE transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "RBAC DELETE transaction_items" ON public.transaction_items;


-- ============================================================
-- 2. Enforce Double-Entry (Balance Check)
-- A transaction must always equal the sum of its splits in 
-- the account_transactions table. We use a DEFERRED constraint
-- trigger so it checks at the end of the transaction after
-- the application code has inserted both the header and splits.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_transaction_balance()
RETURNS trigger AS $$
DECLARE
  v_transaction_total numeric;
  v_splits_total numeric;
BEGIN
  -- Get the total amount from the transaction header
  SELECT COALESCE(total_amount, 0) INTO v_transaction_total
  FROM public.transactions
  WHERE id = NEW.id;

  -- Get the sum of all associated account splits
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_splits_total
  FROM public.account_transactions
  WHERE transaction_id = NEW.id;

  -- Ensure they match exactly
  IF v_transaction_total != v_splits_total THEN
    RAISE EXCEPTION 'Double-entry violation: Transaction % total amount (%) does not match sum of splits (%)', NEW.id, v_transaction_total, v_splits_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create constraint trigger that fires at the end of the transaction commit
DROP TRIGGER IF EXISTS trg_verify_transaction_balance ON public.transactions;
CREATE CONSTRAINT TRIGGER trg_verify_transaction_balance
  AFTER INSERT ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_transaction_balance();

