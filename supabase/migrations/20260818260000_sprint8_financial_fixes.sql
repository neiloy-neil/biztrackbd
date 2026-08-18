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
  p_date date DEFAULT CURRENT_DATE
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

-- ============================================================
-- FIX 5: Drop buggy party balance trigger (P0)
-- The trigger does not see account_transactions, leading to double counting on cash sales.
-- We now update parties.current_due explicitly in the atomic transaction RPCs.
-- ============================================================
DROP TRIGGER IF EXISTS trg_maintain_party_balance ON public.transactions;
DROP FUNCTION IF EXISTS public.maintain_party_balance();

-- ============================================================
-- FIX 6: Update create_transaction_atomic with explicit current_due logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_type         TEXT,
  p_total_amount NUMERIC,
  p_account_id   UUID    DEFAULT NULL,
  p_party_id     UUID    DEFAULT NULL,
  p_category     TEXT    DEFAULT NULL,
  p_notes        TEXT    DEFAULT NULL,
  p_attachments  TEXT[]  DEFAULT NULL,
  p_created_by   UUID    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_account_amount NUMERIC;
  v_party_type     TEXT;
  v_due_delta      NUMERIC := 0;
BEGIN
  IF p_account_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = p_account_id
        AND business_id = p_business_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid account: % does not belong to this business', p_account_id;
    END IF;

    v_account_amount := CASE
      WHEN p_type IN ('sale', 'income', 'payment_in', 'opening_balance') THEN  p_total_amount
      WHEN p_type IN ('expense', 'purchase', 'payment_out')              THEN -p_total_amount
      ELSE p_total_amount
    END;
  END IF;

  INSERT INTO public.transactions (
    business_id, branch_id, type, state, total_amount,
    party_id, category, notes, attachments, created_by
  ) VALUES (
    p_business_id, p_branch_id,
    p_type::public.transaction_type,
    'completed',
    p_total_amount,
    p_party_id, p_category, p_notes,
    COALESCE(p_attachments, ARRAY[]::TEXT[]),
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  IF p_account_id IS NOT NULL THEN
    INSERT INTO public.account_transactions (transaction_id, account_id, amount)
    VALUES (v_transaction_id, p_account_id, v_account_amount);
  END IF;

  -- Maintain explicit party balance
  IF p_party_id IS NOT NULL THEN
    SELECT type INTO v_party_type FROM public.parties WHERE id = p_party_id;
    
    IF v_party_type IN ('customer', 'both') THEN
      IF p_type = 'sale' THEN
        v_due_delta := p_total_amount - (CASE WHEN p_account_id IS NOT NULL THEN p_total_amount ELSE 0 END);
      ELSIF p_type = 'payment_in' THEN
        v_due_delta := -p_total_amount;
      ELSIF p_type = 'opening_balance' THEN
        v_due_delta := p_total_amount;
      END IF;
    END IF;
    
    IF v_party_type IN ('supplier', 'both') THEN
      IF p_type = 'purchase' THEN
        v_due_delta := p_total_amount - (CASE WHEN p_account_id IS NOT NULL THEN p_total_amount ELSE 0 END);
      ELSIF p_type = 'payment_out' THEN
        v_due_delta := -p_total_amount;
      ELSIF p_type = 'opening_balance' THEN
        v_due_delta := p_total_amount;
      END IF;
    END IF;

    IF v_due_delta != 0 THEN
      UPDATE public.parties 
      SET current_due = current_due + v_due_delta, updated_at = now() 
      WHERE id = p_party_id;
    END IF;
  END IF;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 7: Update process_pos_sale with explicit current_due logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id  UUID,
  p_branch_id    UUID,
  p_party_id     UUID,
  p_total_amount NUMERIC,
  p_subtotal     NUMERIC,
  p_discount     NUMERIC,
  p_notes        TEXT,
  p_user_id      UUID,
  p_items        JSONB,
  p_payments     JSONB
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item    RECORD;
  v_payment RECORD;
  v_total_paid NUMERIC := 0;
BEGIN
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      product_id UUID, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC
    )
  LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity,
      v_item.unit_price, v_item.subtotal
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id,
      'out', v_item.quantity, p_user_id
    );
  END LOOP;

  FOR v_payment IN
    SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC)
  LOOP
    IF v_payment.amount > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = v_payment.account_id
          AND business_id = p_business_id
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Invalid payment account: % does not belong to business %',
          v_payment.account_id, p_business_id;
      END IF;

      INSERT INTO public.account_transactions (transaction_id, account_id, amount)
      VALUES (v_transaction_id, v_payment.account_id, v_payment.amount);
      
      v_total_paid := v_total_paid + v_payment.amount;
    END IF;
  END LOOP;
  
  -- Maintain explicit party balance for POS sale
  IF p_party_id IS NOT NULL THEN
    UPDATE public.parties 
    SET current_due = current_due + (p_total_amount - v_total_paid), updated_at = now() 
    WHERE id = p_party_id;
  END IF;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
