-- Migration: Account Balance Materialization
-- This migration caches current_balance on accounts to avoid O(N) aggregation across account_transactions.

-- 1. Add current_balance column to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS current_balance numeric(19,4) DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_balance ON public.accounts(business_id, current_balance);

-- 2. Populate existing balances
UPDATE public.accounts a
SET current_balance = COALESCE((
  SELECT SUM(amount)
  FROM public.account_transactions at
  WHERE at.account_id = a.id
), 0);

-- 3. Create Trigger Function to Maintain Balance
CREATE OR REPLACE FUNCTION public.maintain_account_balance()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts SET current_balance = current_balance + NEW.amount, updated_at = now() WHERE id = NEW.account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.accounts SET current_balance = current_balance - OLD.amount, updated_at = now() WHERE id = OLD.account_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.account_id = OLD.account_id THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount + NEW.amount, updated_at = now() WHERE id = NEW.account_id;
    ELSE
      -- Handle edge case if account_id is updated (unlikely but possible)
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount, updated_at = now() WHERE id = OLD.account_id;
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount, updated_at = now() WHERE id = NEW.account_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Trigger
DROP TRIGGER IF EXISTS trg_maintain_account_balance ON public.account_transactions;
CREATE TRIGGER trg_maintain_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.maintain_account_balance();

-- 5. Update get_dashboard_summary to use O(1) materialized balance
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS json AS $$
DECLARE
  v_total_sales numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_available_money numeric(19,4) := 0;
  v_customer_due numeric(19,4) := 0;
  v_supplier_payable numeric(19,4) := 0;
BEGIN
  -- Verify ownership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Sales within range
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'sale'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Expenses within range
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- O(1) Total Available Money
  SELECT COALESCE(SUM(current_balance), 0) INTO v_available_money
  FROM public.accounts
  WHERE business_id = p_business_id;

  -- O(1) sum of materialized customer dues
  SELECT COALESCE(SUM(current_due), 0) INTO v_customer_due
  FROM public.parties
  WHERE business_id = p_business_id AND type IN ('customer', 'both');

  -- O(1) sum of materialized supplier payables
  SELECT COALESCE(SUM(current_due), 0) INTO v_supplier_payable
  FROM public.parties
  WHERE business_id = p_business_id AND type IN ('supplier', 'both');

  RETURN json_build_object(
    'total_sales', v_total_sales,
    'total_expenses', v_total_expenses,
    'estimated_profit', v_total_sales - v_total_expenses,
    'available_money', v_available_money,
    'customer_due', v_customer_due,
    'supplier_payable', v_supplier_payable
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
