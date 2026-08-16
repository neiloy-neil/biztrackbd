-- Migration: POS Updates

-- 1. Add discount and subtotal to transactions
ALTER TABLE public.transactions
ADD COLUMN subtotal NUMERIC(19,4) DEFAULT 0 NOT NULL,
ADD COLUMN discount NUMERIC(19,4) DEFAULT 0 NOT NULL;

-- 2. Create RPC for atomic POS Sale processing
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id UUID,
  p_branch_id UUID,
  p_party_id UUID, -- Optional customer ID
  p_total_amount NUMERIC,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_notes TEXT,
  p_user_id UUID,
  p_items JSONB, -- Array of { product_id, quantity, unit_price, subtotal }
  p_payments JSONB -- Array of { account_id, amount }
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item RECORD;
  v_payment RECORD;
BEGIN
  -- Insert into transactions
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, 
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- Process Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC
  ) LOOP
    -- 1. Insert Transaction Item
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.subtotal
    );

    -- 2. Insert Inventory Movement
    -- This will automatically trigger `set_inventory_movement_balances` to update stock
    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_transaction_id, 'out', v_item.quantity, p_user_id
    );
  END LOOP;

  -- Process Payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(
    account_id UUID, amount NUMERIC
  ) LOOP
    -- Only insert if amount > 0
    IF v_payment.amount > 0 THEN
      INSERT INTO public.account_transactions (
        transaction_id, account_id, amount
      ) VALUES (
        v_transaction_id, v_payment.account_id, v_payment.amount
      );
    END IF;
  END LOOP;

  -- Note: Customer Due will automatically be calculated by our `v_party_balances` view
  -- because it computes (Sales Total - Payment Received). If payments sum < total_amount, due increases!

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
