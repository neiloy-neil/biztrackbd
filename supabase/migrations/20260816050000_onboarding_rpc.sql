-- Migration: RPC for atomic onboarding

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_business_name text,
  p_category text,
  p_owner_name text,
  p_payment_methods text[],
  p_opening_balances numeric[]
) RETURNS uuid AS $$
DECLARE
  v_business_id uuid;
  v_branch_id uuid;
  v_account_id uuid;
  v_method text;
  v_balance numeric;
  v_i integer;
BEGIN
  -- 1. Create Business
  INSERT INTO public.businesses (name) 
  VALUES (p_business_name) 
  RETURNING id INTO v_business_id;

  -- 2. Create Business Member (Owner)
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (v_business_id, auth.uid(), 'owner');

  -- 3. Create Default Branch
  INSERT INTO public.branches (business_id, name)
  VALUES (v_business_id, 'Main Branch')
  RETURNING id INTO v_branch_id;

  -- 4. Create Category (if provided, else default)
  IF p_category IS NOT NULL THEN
    INSERT INTO public.product_categories (business_id, name)
    VALUES (v_business_id, p_category);
  END IF;

  -- 5. Create Accounts & Opening Balances
  FOR v_i IN 1 .. array_length(p_payment_methods, 1) LOOP
    v_method := p_payment_methods[v_i];
    v_balance := p_opening_balances[v_i];

    -- Create Account
    INSERT INTO public.accounts (business_id, name, type)
    VALUES (v_business_id, v_method, 
      CASE 
        WHEN v_method = 'Cash' THEN 'cash'
        WHEN v_method = 'Bank' THEN 'bank'
        ELSE 'mobile_money'
      END
    ) RETURNING id INTO v_account_id;

    -- If there is an opening balance, record it as a transaction
    IF v_balance > 0 THEN
      -- We'll just record an initial account transaction directly for opening balances
      -- to avoid needing a dummy party or product. 
      -- In a strict double-entry system we'd use a transaction, but for this SaaS, 
      -- an account_transaction without a parent transaction can represent opening equity.
      -- Wait, our schema requires transaction_id for account_transactions.
      -- Let's create a dummy transaction for the opening balance.
      DECLARE
        v_tx_id uuid;
      BEGIN
        INSERT INTO public.transactions (business_id, branch_id, type, state, total_amount, notes, created_by)
        VALUES (v_business_id, v_branch_id, 'opening_balance', 'completed', v_balance, 'Opening Balance', auth.uid())
        RETURNING id INTO v_tx_id;

        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_tx_id, v_account_id, v_balance);
      END;
    END IF;
  END LOOP;

  RETURN v_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
