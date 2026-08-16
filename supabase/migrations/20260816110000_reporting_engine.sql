-- Migration: Professional Reporting Engine RPCs

-- 1. Financial Summary
CREATE OR REPLACE FUNCTION get_financial_summary(p_business_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
  total_income numeric,
  total_expense numeric,
  net_profit numeric,
  cash_in numeric,
  cash_out numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH txn_stats AS (
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE type IN ('sale', 'income')), 0) as inc,
      COALESCE(SUM(total_amount) FILTER (WHERE type IN ('purchase', 'expense')), 0) as exp
    FROM transactions
    WHERE business_id = p_business_id 
      AND state = 'completed'
      AND transaction_date >= p_start_date 
      AND transaction_date <= p_end_date
  ),
  cash_stats AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) as c_in,
      COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) as c_out
    FROM account_transactions
    WHERE transaction_id IN (
      SELECT id FROM transactions 
      WHERE business_id = p_business_id 
      AND state = 'completed'
      AND transaction_date >= p_start_date 
      AND transaction_date <= p_end_date
    )
  )
  SELECT 
    inc as total_income,
    exp as total_expense,
    (inc - exp) as net_profit,
    c_in as cash_in,
    c_out as cash_out
  FROM txn_stats, cash_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Sales Analytics
CREATE OR REPLACE FUNCTION get_sales_analytics(p_business_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
  sales_by_day jsonb,
  sales_by_product jsonb,
  sales_by_category jsonb,
  sales_by_payment jsonb
) AS $$
DECLARE
  v_by_day jsonb;
  v_by_product jsonb;
  v_by_category jsonb;
  v_by_payment jsonb;
BEGIN
  -- Daily
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', transaction_date, 'total', daily_total)), '[]'::jsonb)
  INTO v_by_day
  FROM (
    SELECT transaction_date, SUM(total_amount) as daily_total
    FROM transactions
    WHERE business_id = p_business_id AND type = 'sale' AND state = 'completed'
      AND transaction_date >= p_start_date AND transaction_date <= p_end_date
    GROUP BY transaction_date
    ORDER BY transaction_date
  ) d;

  -- Product
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', name, 'qty', total_qty, 'revenue', total_rev)), '[]'::jsonb)
  INTO v_by_product
  FROM (
    SELECT p.name, SUM(ti.quantity) as total_qty, SUM(ti.subtotal) as total_rev
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.business_id = p_business_id AND t.type = 'sale' AND t.state = 'completed'
      AND t.transaction_date >= p_start_date AND t.transaction_date <= p_end_date
    GROUP BY p.name
    ORDER BY total_rev DESC
    LIMIT 20
  ) prod;

  -- Category
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', cat_name, 'revenue', total_rev)), '[]'::jsonb)
  INTO v_by_category
  FROM (
    SELECT COALESCE(c.name, 'Uncategorized') as cat_name, SUM(ti.subtotal) as total_rev
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN products p ON p.id = ti.product_id
    LEFT JOIN product_categories c ON c.id = p.category_id
    WHERE t.business_id = p_business_id AND t.type = 'sale' AND t.state = 'completed'
      AND t.transaction_date >= p_start_date AND t.transaction_date <= p_end_date
    GROUP BY c.name
    ORDER BY total_rev DESC
  ) cat;

  -- Payment methods
  SELECT COALESCE(jsonb_agg(jsonb_build_object('account', acc_name, 'amount', total_amt)), '[]'::jsonb)
  INTO v_by_payment
  FROM (
    SELECT a.name as acc_name, SUM(act.amount) as total_amt
    FROM account_transactions act
    JOIN accounts a ON a.id = act.account_id
    JOIN transactions t ON t.id = act.transaction_id
    WHERE t.business_id = p_business_id AND t.type = 'sale' AND t.state = 'completed'
      AND t.transaction_date >= p_start_date AND t.transaction_date <= p_end_date
      AND act.amount > 0
    GROUP BY a.name
    ORDER BY total_amt DESC
  ) pay;

  RETURN QUERY SELECT v_by_day, v_by_product, v_by_category, v_by_payment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Expense Analytics
CREATE OR REPLACE FUNCTION get_expense_analytics(p_business_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
  expense_by_category jsonb,
  expense_trend jsonb
) AS $$
DECLARE
  v_by_cat jsonb;
  v_trend jsonb;
BEGIN
  -- Normally expenses are categorized via 'notes' or a 'transaction_category' table if it exists.
  -- The schema indicates an expense is just a transaction. If there's no category table for expenses, we group by notes or simply list top expenses.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', COALESCE(notes, 'General'), 'total', total_exp)), '[]'::jsonb)
  INTO v_by_cat
  FROM (
    SELECT notes, SUM(total_amount) as total_exp
    FROM transactions
    WHERE business_id = p_business_id AND type = 'expense' AND state = 'completed'
      AND transaction_date >= p_start_date AND transaction_date <= p_end_date
    GROUP BY notes
    ORDER BY total_exp DESC
    LIMIT 15
  ) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', transaction_date, 'total', daily_total)), '[]'::jsonb)
  INTO v_trend
  FROM (
    SELECT transaction_date, SUM(total_amount) as daily_total
    FROM transactions
    WHERE business_id = p_business_id AND type = 'expense' AND state = 'completed'
      AND transaction_date >= p_start_date AND transaction_date <= p_end_date
    GROUP BY transaction_date
    ORDER BY transaction_date
  ) d;

  RETURN QUERY SELECT v_by_cat, v_trend;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Due Report (using existing party_balances_view logic)
CREATE OR REPLACE FUNCTION get_party_dues(p_business_id uuid)
RETURNS TABLE (
  customer_dues jsonb,
  supplier_payables jsonb
) AS $$
DECLARE
  v_customers jsonb;
  v_suppliers jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', party_id, 'name', name, 'phone', phone, 'balance', total_due)), '[]'::jsonb)
  INTO v_customers
  FROM (
    SELECT p.id as party_id, p.name, p.phone, 
           (COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'sale' OR t.type = 'opening_balance'), 0) - 
            COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'payment_in'), 0)) as total_due
    FROM parties p
    LEFT JOIN transactions t ON t.party_id = p.id AND t.state = 'completed'
    WHERE p.business_id = p_business_id AND (p.type = 'customer' OR p.type = 'both')
    GROUP BY p.id, p.name, p.phone
    HAVING (COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'sale' OR t.type = 'opening_balance'), 0) - COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'payment_in'), 0)) > 0
    ORDER BY total_due DESC
  ) cust;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', party_id, 'name', name, 'phone', phone, 'balance', total_payable)), '[]'::jsonb)
  INTO v_suppliers
  FROM (
    SELECT p.id as party_id, p.name, p.phone, 
           (COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'purchase' OR t.type = 'opening_balance'), 0) - 
            COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'payment_out'), 0)) as total_payable
    FROM parties p
    LEFT JOIN transactions t ON t.party_id = p.id AND t.state = 'completed'
    WHERE p.business_id = p_business_id AND (p.type = 'supplier' OR p.type = 'both')
    GROUP BY p.id, p.name, p.phone
    HAVING (COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'purchase' OR t.type = 'opening_balance'), 0) - COALESCE(SUM(t.total_amount) FILTER (WHERE t.type = 'payment_out'), 0)) > 0
    ORDER BY total_payable DESC
  ) supp;

  RETURN QUERY SELECT v_customers, v_suppliers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Inventory Analytics
CREATE OR REPLACE FUNCTION get_inventory_analytics(p_business_id uuid)
RETURNS TABLE (
  total_valuation numeric,
  low_stock_items jsonb,
  stock_valuation_list jsonb
) AS $$
DECLARE
  v_valuation numeric;
  v_low jsonb;
  v_list jsonb;
BEGIN
  -- Re-use product current stock logic
  WITH stock_calc AS (
    SELECT 
      p.id as product_id, 
      p.name, 
      p.cost, 
      p.price,
      COALESCE(SUM(CASE WHEN im.type = 'in' THEN im.quantity WHEN im.type = 'out' THEN -im.quantity ELSE im.quantity END), 0) as current_stock
    FROM products p
    LEFT JOIN inventory_movements im ON im.product_id = p.id
    WHERE p.business_id = p_business_id AND p.deleted_at IS NULL
    GROUP BY p.id, p.name, p.cost, p.price
  )
  SELECT SUM(current_stock * cost) INTO v_valuation FROM stock_calc WHERE current_stock > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'stock', current_stock)), '[]'::jsonb)
  INTO v_low
  FROM (
    WITH stock_calc AS (
      SELECT p.id as product_id, p.name, COALESCE(SUM(CASE WHEN im.type = 'in' THEN im.quantity WHEN im.type = 'out' THEN -im.quantity ELSE im.quantity END), 0) as current_stock
      FROM products p LEFT JOIN inventory_movements im ON im.product_id = p.id
      WHERE p.business_id = p_business_id AND p.deleted_at IS NULL
      GROUP BY p.id, p.name
    )
    SELECT name, current_stock FROM stock_calc WHERE current_stock <= 10 ORDER BY current_stock ASC LIMIT 20
  ) l;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'stock', current_stock, 'cost', cost, 'value', current_stock * cost)), '[]'::jsonb)
  INTO v_list
  FROM (
    WITH stock_calc AS (
      SELECT p.id as product_id, p.name, p.cost, COALESCE(SUM(CASE WHEN im.type = 'in' THEN im.quantity WHEN im.type = 'out' THEN -im.quantity ELSE im.quantity END), 0) as current_stock
      FROM products p LEFT JOIN inventory_movements im ON im.product_id = p.id
      WHERE p.business_id = p_business_id AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.cost
    )
    SELECT name, current_stock, cost FROM stock_calc WHERE current_stock > 0 ORDER BY (current_stock * cost) DESC LIMIT 50
  ) lst;

  RETURN QUERY SELECT COALESCE(v_valuation, 0), v_low, v_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
