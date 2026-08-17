-- =============================================================
-- Migration: Phase 6 - Financial Integrity P2/P3 Fixes
-- =============================================================

-- ============================================================
-- 1. P2-1 & P2-2: Reporting Engine Fixes (get_financial_summary & get_party_dues)
-- ============================================================
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
      COALESCE(SUM(total_amount) FILTER (WHERE type = 'sale'), 0) as sales,
      COALESCE(SUM(total_amount) FILTER (WHERE type = 'income'), 0) as income,
      COALESCE(SUM(total_amount) FILTER (WHERE type = 'expense'), 0) as expenses
    FROM public.transactions
    WHERE business_id = p_business_id 
      AND state = 'completed'
      AND transaction_date >= p_start_date 
      AND transaction_date <= p_end_date
  ),
  cogs_stats AS (
    SELECT COALESCE(SUM(ti.quantity * p.cost), 0) as cogs
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    JOIN public.products p ON p.id = ti.product_id
    WHERE t.business_id = p_business_id
      AND t.state = 'completed'
      AND t.type = 'sale'
      AND t.transaction_date >= p_start_date 
      AND t.transaction_date <= p_end_date
  ),
  cash_stats AS (
    SELECT
      COALESCE(SUM(at.amount) FILTER (WHERE at.amount > 0), 0) as c_in,
      COALESCE(SUM(ABS(at.amount)) FILTER (WHERE at.amount < 0), 0) as c_out
    FROM public.account_transactions at
    JOIN public.transactions t ON t.id = at.transaction_id
    WHERE t.business_id = p_business_id
      AND t.state = 'completed'
      AND t.type != 'transfer' -- Exclude internal transfers from top-level cash flow
      AND t.transaction_date >= p_start_date 
      AND t.transaction_date <= p_end_date
  )
  SELECT 
    (t.sales + t.income) as total_income,
    (c.cogs + t.expenses) as total_expense, 
    ((t.sales + t.income) - (c.cogs + t.expenses)) as net_profit,
    cs.c_in as cash_in,
    cs.c_out as cash_out
  FROM txn_stats t, cogs_stats c, cash_stats cs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_party_dues(p_business_id uuid)
RETURNS TABLE (
  customer_dues jsonb,
  supplier_payables jsonb
) AS $$
DECLARE
  v_customers jsonb;
  v_suppliers jsonb;
BEGIN
  -- We query the v_party_balances view created in the P0 fixes
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', party_id, 'name', party_name, 'phone', party_phone, 'balance', ABS(balance))), '[]'::jsonb)
  INTO v_customers
  FROM public.v_party_balances
  WHERE business_id = p_business_id AND party_type IN ('customer', 'both') AND balance > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', party_id, 'name', party_name, 'phone', party_phone, 'balance', ABS(balance))), '[]'::jsonb)
  INTO v_suppliers
  FROM public.v_party_balances
  WHERE business_id = p_business_id AND party_type IN ('supplier', 'both') AND balance < 0;

  RETURN QUERY SELECT v_customers, v_suppliers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. P2-7: Inventory Analytics Fix
-- ============================================================
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
  SELECT COALESCE(SUM(current_stock * cost), 0) INTO v_valuation 
  FROM public.products 
  WHERE business_id = p_business_id AND deleted_at IS NULL AND current_stock > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'stock', current_stock)), '[]'::jsonb)
  INTO v_low
  FROM public.products 
  WHERE business_id = p_business_id AND deleted_at IS NULL AND current_stock <= 10 
  ORDER BY current_stock ASC LIMIT 20;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'stock', current_stock, 'cost', cost, 'value', current_stock * cost)), '[]'::jsonb)
  INTO v_list
  FROM public.products 
  WHERE business_id = p_business_id AND deleted_at IS NULL AND current_stock > 0 
  ORDER BY (current_stock * cost) DESC LIMIT 50;

  RETURN QUERY SELECT COALESCE(v_valuation, 0), v_low, v_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. P2-4: Strict Sign Convention Constraints
-- ============================================================
-- Ensure amount cannot be 0 to prevent empty accounting splits
ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS chk_account_transactions_nonzero;
ALTER TABLE public.account_transactions ADD CONSTRAINT chk_account_transactions_nonzero CHECK (amount != 0);

-- ============================================================
-- 4. P2-8: Timezone Fix for Transaction Date
-- ============================================================
ALTER TABLE public.transactions ALTER COLUMN transaction_date SET DEFAULT (current_timestamp at time zone 'Asia/Dhaka')::date;

-- ============================================================
-- 5. P3-3: Historical Ledger Locks for daily_closings
-- ============================================================
DROP POLICY IF EXISTS "Tenant isolation UPDATE daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Tenant isolation DELETE daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "RBAC UPDATE daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "RBAC DELETE daily_closings" ON public.daily_closings;

-- ============================================================
-- 6. P3-5: Financial Audit Triggers
-- ============================================================
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.trg_audit_inventory_adjustment()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'adjustment' THEN
    INSERT INTO public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
    VALUES (NEW.business_id, NEW.created_by, 'INVENTORY_ADJUSTMENT', 'inventory_movements', NEW.id, jsonb_build_object('product_id', NEW.product_id, 'quantity', NEW.quantity, 'reason', NEW.reason));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_inventory_adjustment ON public.inventory_movements;
CREATE TRIGGER audit_inventory_adjustment
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_inventory_adjustment();
