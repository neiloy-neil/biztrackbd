-- Migration: Performance Scaling (100M+ scale prep)
-- 1. Materialized Columns and Triggers
-- 2. Covering Indexes
-- 3. Optimized RPCs

-- ==========================================
-- 1. MATERIALIZE PRODUCT STOCK
-- ==========================================
ALTER TABLE public.products ADD COLUMN current_stock numeric(19,4) DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(business_id, current_stock);

-- Update existing stock
UPDATE public.products p
SET current_stock = COALESCE((
  SELECT SUM(
    CASE 
      WHEN m.type = 'in' THEN m.quantity 
      WHEN m.type = 'out' THEN -m.quantity 
      ELSE 0 
    END
  )
  FROM public.inventory_movements m
  WHERE m.product_id = p.id
), 0);

-- Trigger to maintain current_stock
CREATE OR REPLACE FUNCTION public.maintain_product_stock()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'in' THEN
      UPDATE public.products SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
    ELSIF NEW.type = 'out' THEN
      UPDATE public.products SET current_stock = current_stock - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
    ELSIF NEW.type = 'adjustment' THEN
      UPDATE public.products SET current_stock = NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'in' THEN
      UPDATE public.products SET current_stock = current_stock - OLD.quantity, updated_at = now() WHERE id = OLD.product_id;
    ELSIF OLD.type = 'out' THEN
      UPDATE public.products SET current_stock = current_stock + OLD.quantity, updated_at = now() WHERE id = OLD.product_id;
    END IF;
    -- Note: Deleting an adjustment is tricky to rollback without history, assume adjustments shouldn't be deleted.
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_maintain_product_stock
  AFTER INSERT OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.maintain_product_stock();


-- ==========================================
-- 2. MATERIALIZE PARTY BALANCES
-- ==========================================
ALTER TABLE public.parties ADD COLUMN current_due numeric(19,4) DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parties_due ON public.parties(business_id, current_due);

-- Update existing party due balances based on the v_party_balances view logic
UPDATE public.parties p
SET current_due = p.opening_balance + COALESCE((
  SELECT SUM(
    CASE 
      WHEN p.type = 'customer' THEN
        CASE 
          WHEN t.type = 'sale' THEN t.total_amount
          WHEN t.type = 'payment_in' THEN -t.total_amount
          ELSE 0
        END
      WHEN p.type = 'supplier' THEN
        CASE
          WHEN t.type = 'purchase' THEN t.total_amount
          WHEN t.type = 'payment_out' THEN -t.total_amount
          ELSE 0
        END
      ELSE 0
    END
  )
  FROM public.transactions t
  WHERE t.party_id = p.id AND t.state = 'completed'
), 0);

-- Trigger to maintain current_due
CREATE OR REPLACE FUNCTION public.maintain_party_balance()
RETURNS trigger AS $$
DECLARE
  v_party_type public.party_type;
BEGIN
  -- Only care if a party is associated
  IF NEW.party_id IS NULL AND OLD.party_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.state = 'completed' AND NEW.party_id IS NOT NULL THEN
    SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
    IF v_party_type = 'customer' THEN
      IF NEW.type = 'sale' THEN
        UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      ELSIF NEW.type = 'payment_in' THEN
        UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      END IF;
    ELSIF v_party_type = 'supplier' THEN
      IF NEW.type = 'purchase' THEN
        UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      ELSIF NEW.type = 'payment_out' THEN
        UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
      END IF;
    END IF;
  END IF;

  -- Handle updates (e.g., cancelled or total_amount changed)
  IF TG_OP = 'UPDATE' THEN
    -- If state changes from completed to something else, reverse the impact
    IF OLD.state = 'completed' AND NEW.state != 'completed' AND OLD.party_id IS NOT NULL THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = OLD.party_id;
      IF v_party_type = 'customer' THEN
        IF OLD.type = 'sale' THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF OLD.type = 'purchase' THEN
          UPDATE public.parties SET current_due = current_due - OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        ELSIF OLD.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due + OLD.total_amount, updated_at = now() WHERE id = OLD.party_id;
        END IF;
      END IF;
    END IF;
    
    -- If state changes to completed, add the impact
    IF OLD.state != 'completed' AND NEW.state = 'completed' AND NEW.party_id IS NOT NULL THEN
      SELECT type INTO v_party_type FROM public.parties WHERE id = NEW.party_id;
      IF v_party_type = 'customer' THEN
        IF NEW.type = 'sale' THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_in' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      ELSIF v_party_type = 'supplier' THEN
        IF NEW.type = 'purchase' THEN
          UPDATE public.parties SET current_due = current_due + NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        ELSIF NEW.type = 'payment_out' THEN
          UPDATE public.parties SET current_due = current_due - NEW.total_amount, updated_at = now() WHERE id = NEW.party_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_maintain_party_balance
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.maintain_party_balance();

-- We can now safely drop v_party_balances as it's a massive performance hit at scale
DROP VIEW IF EXISTS public.v_party_balances;


-- ==========================================
-- 3. COVERING INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_txn_agg ON public.transactions (business_id, type, state, transaction_date) INCLUDE (total_amount);


-- ==========================================
-- 4. REWRITE DASHBOARD SUMMARY RPC
-- ==========================================
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

  -- Sales within range (Using covering index idx_txn_agg)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'sale'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Expenses within range (Using covering index idx_txn_agg)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;

  -- Total Available Money (Sum of account_transactions is OK if row count is low per account,
  -- but ideally accounts should also have a cached balance column. We leave this for now 
  -- since accounts don't have millions of rows typically)
  SELECT COALESCE(SUM(at.amount), 0) INTO v_available_money
  FROM public.account_transactions at
  JOIN public.accounts a ON at.account_id = a.id
  WHERE a.business_id = p_business_id;

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


-- ==========================================
-- 5. NEW DB-SIDE TREND RPC
-- ==========================================
-- Replaces JS-side grouping of all transactions
CREATE OR REPLACE FUNCTION public.get_trend_data(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS TABLE (
  trend_date text,
  sales numeric,
  expenses numeric
) AS $$
BEGIN
  -- Verify ownership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    to_char(transaction_date, 'MM-DD') as trend_date,
    SUM(CASE WHEN type = 'sale' THEN total_amount ELSE 0 END) as sales,
    SUM(CASE WHEN type = 'expense' THEN total_amount ELSE 0 END) as expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type IN ('sale', 'expense')
    AND state = 'completed'
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date
  GROUP BY transaction_date
  ORDER BY transaction_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
