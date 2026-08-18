-- Migration: Update RPC for atomic onboarding to support updating existing skeleton businesses

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_business_name text,
  p_category text,
  p_owner_name text,
  p_payment_methods text[],
  p_opening_balances numeric[],
  p_existing_business_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_business_id uuid;
  v_branch_id uuid;
  v_account_id uuid;
  v_method text;
  v_balance numeric;
  v_i integer;
BEGIN
  IF p_existing_business_id IS NOT NULL THEN
    -- Verify the user actually owns this business
    IF NOT EXISTS (
      SELECT 1 FROM public.business_members 
      WHERE business_id = p_existing_business_id AND user_id = auth.uid() AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Unauthorized or invalid existing business';
    END IF;

    -- Update existing skeleton business
    UPDATE public.businesses 
    SET name = p_business_name
    WHERE id = p_existing_business_id
    RETURNING id INTO v_business_id;
  ELSE
    -- 1. Create Business
    INSERT INTO public.businesses (name) 
    VALUES (p_business_name) 
    RETURNING id INTO v_business_id;

    -- 2. Create Business Member (Owner)
    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (v_business_id, auth.uid(), 'owner');
  END IF;

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
