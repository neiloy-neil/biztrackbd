-- Migration: P0 and P1 Financial Integrity Fixes

-- ============================================================
-- FIX 1: Party Balances (P0)
-- Point-of-sale payments were ignored. Now they are correctly subtracted/added.
-- ============================================================
CREATE OR REPLACE VIEW public.v_party_balances AS
WITH paid_amounts AS (
  SELECT transaction_id, SUM(amount) as paid_amount
  FROM public.account_transactions
  GROUP BY transaction_id
)
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
          (CASE WHEN t.type = 'sale' THEN t.total_amount ELSE 0 END) - 
          (CASE WHEN t.type IN ('sale', 'payment_in') THEN COALESCE(paid.paid_amount, 0) ELSE 0 END)
        WHEN p.type = 'supplier' THEN
          (CASE WHEN t.type = 'purchase' THEN t.total_amount ELSE 0 END) + 
          (CASE WHEN t.type IN ('purchase', 'payment_out') THEN COALESCE(paid.paid_amount, 0) ELSE 0 END)
        ELSE 0
      END
    )
  , 0) as current_due
FROM public.parties p
LEFT JOIN public.transactions t 
  ON p.id = t.party_id 
  AND t.state = 'completed'
LEFT JOIN paid_amounts paid
  ON paid.transaction_id = t.id
WHERE p.deleted_at IS NULL
GROUP BY p.id;

ALTER VIEW public.v_party_balances SET (security_invoker = on);
GRANT SELECT ON public.v_party_balances TO authenticated;
GRANT SELECT ON public.v_party_balances TO service_role;

-- ============================================================
-- FIX 2: Daily Closing Summary (P1 & P2)
-- Correct profit formula (Sales - COGS + Income - Expenses)
-- Include ALL transaction types in cash breakdown
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_closing_summary(
  p_business_id uuid,
  p_date date
)
RETURNS jsonb AS $$
DECLARE
  v_expected_cash numeric(19,4) := 0;
  
  v_cash_opening numeric(19,4) := 0;
  v_cash_sales numeric(19,4) := 0;
  v_cash_expenses numeric(19,4) := 0;
  v_cash_received numeric(19,4) := 0;
  v_cash_paid numeric(19,4) := 0;
  v_cash_purchases numeric(19,4) := 0;
  v_cash_income numeric(19,4) := 0;
  v_cash_transfers numeric(19,4) := 0;
  
  v_total_sales numeric(19,4) := 0;
  v_total_cogs numeric(19,4) := 0;
  v_total_income numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_total_profit numeric(19,4) := 0;

  v_bkash numeric(19,4) := 0;
  v_nagad numeric(19,4) := 0;
  v_bank numeric(19,4) := 0;
BEGIN
  -- 1. Calculate Expected Cash (sum of all cash account_transactions up to p_date)
  SELECT COALESCE(SUM(at.amount), 0) INTO v_expected_cash
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.transaction_date <= p_date;

  -- 2. Calculate Today's Cash Movements (Breakdown)
  
  -- Opening Balances
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_opening
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'opening_balance' AND t.transaction_date = p_date;

  -- Sales
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_sales
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'sale' AND t.transaction_date = p_date;

  -- Income
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_income
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'income' AND t.transaction_date = p_date;

  -- Expenses
  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_expenses
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'expense' AND t.transaction_date = p_date;

  -- Purchases
  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_purchases
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'purchase' AND t.transaction_date = p_date;

  -- Cash Received (payment_in)
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_received
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'payment_in' AND t.transaction_date = p_date;

  -- Cash Paid (payment_out)
  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_paid
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'payment_out' AND t.transaction_date = p_date;

  -- Transfers
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_transfers
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'cash' AND t.type = 'transfer' AND t.transaction_date = p_date;

  -- 3. Overall Daily Metrics (Profitability)
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'sale' AND transaction_date = p_date;
  
  -- Calculate COGS by joining transaction_items and products
  SELECT COALESCE(SUM(ti.quantity * p.cost), 0) INTO v_total_cogs
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.products p ON p.id = ti.product_id
  WHERE t.business_id = p_business_id AND t.type = 'sale' AND t.transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_income
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'income' AND transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'expense' AND transaction_date = p_date;

  v_total_profit := (v_total_sales - v_total_cogs) + v_total_income - v_total_expenses;

  -- 4. Other Balances (bkash, nagad, bank) up to date
  SELECT COALESCE(SUM(at.amount), 0) INTO v_bkash
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.name ILIKE '%bkash%' AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_nagad
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.name ILIKE '%nagad%' AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_bank
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'bank' AND t.transaction_date <= p_date;

  RETURN jsonb_build_object(
    'expected_cash', v_expected_cash,
    'cash_opening', v_cash_opening,
    'cash_sales', v_cash_sales,
    'cash_expenses', v_cash_expenses,
    'cash_purchases', v_cash_purchases,
    'cash_income', v_cash_income,
    'cash_received', v_cash_received,
    'cash_paid', v_cash_paid,
    'cash_transfers', v_cash_transfers,
    'total_sales', v_total_sales,
    'total_cogs', v_total_cogs,
    'total_income', v_total_income,
    'total_expenses', v_total_expenses,
    'total_profit', v_total_profit,
    'balances', jsonb_build_object(
      'cash', v_expected_cash,
      'bkash', v_bkash,
      'nagad', v_nagad,
      'bank', v_bank
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 3: Atomic Transfers (P0)
-- Create a new RPC to handle double-entry transfers atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transfer_atomic(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_amount       NUMERIC,
  p_from_account_id UUID,
  p_to_account_id   UUID,
  p_notes        TEXT    DEFAULT NULL,
  p_created_by   UUID    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Validate amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Validate accounts exist and belong to business
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_from_account_id AND business_id = p_business_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid source account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_to_account_id AND business_id = p_business_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid destination account';
  END IF;

  -- 1. Create the Transaction
  INSERT INTO public.transactions (
    business_id, branch_id, type, state, total_amount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, 'transfer', 'completed', p_amount, p_notes, p_created_by
  ) RETURNING id INTO v_transaction_id;

  -- 2. Create the Source Account Deduction (Negative)
  INSERT INTO public.account_transactions (transaction_id, account_id, amount)
  VALUES (v_transaction_id, p_from_account_id, -p_amount);

  -- 3. Create the Destination Account Addition (Positive)
  INSERT INTO public.account_transactions (transaction_id, account_id, amount)
  VALUES (v_transaction_id, p_to_account_id, p_amount);

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 4: Double-Entry Trigger (P0)
-- The Phase 2 trigger blocked partial payments. We must allow 
-- sales and purchases to have splits <= total_amount.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_transaction_balance()
RETURNS trigger AS $$
DECLARE
  v_transaction_total numeric;
  v_splits_total numeric;
  v_type text;
BEGIN
  -- Get the total amount from the transaction header
  SELECT COALESCE(total_amount, 0), type INTO v_transaction_total, v_type
  FROM public.transactions
  WHERE id = NEW.id;

  -- Get the sum of all associated account splits
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_splits_total
  FROM public.account_transactions
  WHERE transaction_id = NEW.id;

  -- For sales and purchases, the splits represent cash received/paid,
  -- which can be less than or equal to the total_amount (partial payment).
  IF v_type IN ('sale', 'purchase') THEN
    IF v_splits_total > v_transaction_total THEN
      RAISE EXCEPTION 'Double-entry violation: Payment (%) cannot exceed transaction total (%)', v_splits_total, v_transaction_total;
    END IF;
  ELSIF v_type = 'transfer' THEN
    -- Transfers have a positive and a negative split. sum of absolute is 2 * total_amount
    IF v_splits_total != (v_transaction_total * 2) THEN
      RAISE EXCEPTION 'Double-entry violation: Transfer transaction % total amount (%) does not match sum of splits (%)', NEW.id, v_transaction_total, v_splits_total;
    END IF;
  ELSE
    -- For all other types (expense, income), it must match exactly.
    IF v_transaction_total != v_splits_total THEN
      RAISE EXCEPTION 'Double-entry violation: Transaction % total amount (%) does not match sum of splits (%)', NEW.id, v_transaction_total, v_splits_total;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
