-- =============================================================
-- Migration: Sprint 10 Performance & Scalability (P1)
-- Description: Missing FK indexes & Dashboard O(N) degradation fix
-- =============================================================

-- ── 1. Missing Foreign Key Indexes ─────────────────────────────────
-- Transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_branch_id ON public.transactions(branch_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_party_id ON public.transactions(party_id);

-- Transaction Items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_items_product_id ON public.transaction_items(product_id);

-- Account Transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_transaction_id ON public.account_transactions(transaction_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_account_id ON public.account_transactions(account_id);

-- Inventory Movements
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_business_id ON public.inventory_movements(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_branch_id ON public.inventory_movements(branch_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_transaction_id ON public.inventory_movements(transaction_id);

-- Products & Categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Parties
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parties_business_id ON public.parties(business_id);

-- Accounts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_business_id ON public.accounts(business_id);

-- Branches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_business_id ON public.branches(business_id);


-- ── 2. Dashboard O(N) Degradation Fix ────────────────────────────
-- Replace exact COUNT(*) with an EXISTS check (.limit(1)) for low stock
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

  -- PERF-01: Removed exact COUNT(*) which causes O(N) degradation on products table.
  -- Use an EXISTS check mapping to 1 (true) or 0 (false) to trigger the UI alert.
  SELECT (EXISTS (
    SELECT 1
    FROM public.products
    WHERE business_id = p_business_id
      AND deleted_at IS NULL
      AND current_stock <= min_stock
    LIMIT 1
  ))::int INTO v_low_stock_count;

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

-- ── 3. Inventory Stats RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inventory_stats(p_business_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_total_items int;
  v_total_value numeric(19,4);
  v_low_stock_count int;
BEGIN
  SELECT 
    COUNT(*), 
    COALESCE(SUM(current_stock * price), 0),
    COUNT(*) FILTER (WHERE current_stock <= min_stock)
  INTO 
    v_total_items, 
    v_total_value, 
    v_low_stock_count
  FROM public.products
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'total_items', v_total_items,
    'total_value', v_total_value,
    'low_stock_count', v_low_stock_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_inventory_stats(uuid) TO authenticated;
