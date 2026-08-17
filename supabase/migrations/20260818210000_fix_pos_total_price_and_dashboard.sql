-- Fix 1: process_pos_sale inserted total_price into transaction_items but that
-- column does not exist. total_price is a derived value (quantity * unit_price)
-- and is not stored; remove it from the INSERT.

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
  v_transaction_id  UUID;
  v_payment_txn_id  UUID;
  v_item            RECORD;
  v_payment         RECORD;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access Denied: You are not a member of this business.';
  END IF;

  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state,
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    p_total_amount, p_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- total_price omitted: column does not exist on transaction_items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC, total_price NUMERIC)
  LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_item.unit_price
    );
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC)
  LOOP
    IF v_payment.amount > 0 THEN
      IF p_party_id IS NOT NULL THEN
        INSERT INTO public.transactions (
          business_id, branch_id, party_id, type, state,
          total_amount, notes, created_by, reference_id
        ) VALUES (
          p_business_id, p_branch_id, p_party_id, 'payment_in', 'completed',
          v_payment.amount, 'POS Payment for Sale', p_user_id, v_transaction_id
        ) RETURNING id INTO v_payment_txn_id;

        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_payment_txn_id, v_payment.account_id, v_payment.amount);
      ELSE
        INSERT INTO public.account_transactions (transaction_id, account_id, amount)
        VALUES (v_transaction_id, v_payment.account_id, v_payment.amount);
      END IF;
    END IF;
  END LOOP;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fix 2: get_dashboard_summary was missing gross_profit and available_money.
-- Also fixes field name mismatches: the component read estimated_profit/supplier_payable
-- but the RPC returned net_profit/supplier_due.

DROP FUNCTION IF EXISTS public.get_dashboard_summary(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_business_id uuid,
  p_start_date  date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date    date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
  v_total_sales      numeric(19,4) := 0;
  v_total_income     numeric(19,4) := 0;
  v_total_cogs       numeric(19,4) := 0;
  v_total_expenses   numeric(19,4) := 0;
  v_gross_profit     numeric(19,4) := 0;
  v_net_profit       numeric(19,4) := 0;
  v_customer_due     numeric(19,4) := 0;
  v_supplier_due     numeric(19,4) := 0;
  v_available_money  numeric(19,4) := 0;
  v_low_stock_count  int := 0;
BEGIN
  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE type = 'income'), 0)
  INTO v_total_sales, v_total_income
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  SELECT COALESCE(SUM(ti.quantity * p.cost), 0) INTO v_total_cogs
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.products p ON p.id = ti.product_id
  WHERE t.business_id = p_business_id
    AND t.state = 'completed'
    AND t.type = 'sale'
    AND t.transaction_date >= p_start_date
    AND t.transaction_date <= p_end_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND state = 'completed'
    AND type = 'expense'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  v_gross_profit := v_total_sales - v_total_cogs;
  v_net_profit   := v_gross_profit + v_total_income - v_total_expenses;

  SELECT
    COALESCE(SUM(current_due) FILTER (WHERE type IN ('customer', 'both')), 0),
    COALESCE(SUM(current_due) FILTER (WHERE type IN ('supplier', 'both')), 0)
  INTO v_customer_due, v_supplier_due
  FROM public.parties
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(current_balance), 0) INTO v_available_money
  FROM public.accounts
  WHERE business_id = p_business_id
    AND type IN ('cash', 'bank')
    AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_low_stock_count
  FROM public.products
  WHERE business_id = p_business_id
    AND deleted_at IS NULL
    AND current_stock <= min_stock;

  RETURN jsonb_build_object(
    'total_revenue',    v_total_sales + v_total_income,
    'total_sales',      v_total_sales,
    'total_income',     v_total_income,
    'total_cogs',       v_total_cogs,
    'gross_profit',     v_gross_profit,
    'total_expenses',   v_total_expenses,
    'net_profit',       v_net_profit,
    'customer_due',     v_customer_due,
    'supplier_due',     v_supplier_due,
    'available_money',  v_available_money,
    'low_stock_count',  v_low_stock_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, date, date) TO authenticated;
