-- Migration: Actionable Insights RPC
-- Creates a secure RPC for extracting business intelligence (Low Stock, Debtors, Expenses, Sales)

CREATE OR REPLACE FUNCTION public.get_actionable_insights(
  p_business_id uuid
) RETURNS json AS $$
DECLARE
  v_low_stock json;
  v_top_debtors json;
  v_expense_spikes json;
  v_top_selling json;
  v_this_week_expenses numeric(19,4) := 0;
  v_last_week_expenses numeric(19,4) := 0;
BEGIN
  -- Verify ownership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Low Stock Alerts
  -- Products where current_stock <= min_stock (and min_stock > 0 to avoid noise)
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'current_stock', p.current_stock,
      'min_stock', p.min_stock
    )
  ), '[]'::json) INTO v_low_stock
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.current_stock <= p.min_stock
    AND p.min_stock > 0
    AND p.deleted_at IS NULL
  LIMIT 5;

  -- 2. Top Debtors
  -- Top 5 customers with highest current_due
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', pt.id,
      'name', pt.name,
      'phone', pt.phone,
      'current_due', pt.current_due
    )
  ), '[]'::json) INTO v_top_debtors
  FROM public.parties pt
  WHERE pt.business_id = p_business_id
    AND pt.type IN ('customer', 'both')
    AND pt.current_due > 0
    AND pt.deleted_at IS NULL
  ORDER BY pt.current_due DESC
  LIMIT 5;

  -- 3. Expense Spikes
  -- Compare this week (last 7 days) to last week (7-14 days ago)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= current_date - interval '7 days';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id
    AND type = 'expense'
    AND state = 'completed'
    AND transaction_date >= current_date - interval '14 days'
    AND transaction_date < current_date - interval '7 days';

  v_expense_spikes := json_build_object(
    'this_week', v_this_week_expenses,
    'last_week', v_last_week_expenses,
    'spike_percentage', CASE 
      WHEN v_last_week_expenses > 0 THEN 
        ROUND(((v_this_week_expenses - v_last_week_expenses) / v_last_week_expenses) * 100, 2)
      ELSE 0
    END
  );

  -- 4. Top Selling Products (Last 30 days)
  SELECT COALESCE(json_agg(
    json_build_object(
      'product_id', sub.product_id,
      'name', p.name,
      'total_sold', sub.total_sold
    )
  ), '[]'::json) INTO v_top_selling
  FROM (
    SELECT product_id, SUM(quantity) as total_sold
    FROM public.inventory_movements
    WHERE business_id = p_business_id
      AND type = 'out'
      AND created_at >= current_date - interval '30 days'
    GROUP BY product_id
    ORDER BY total_sold DESC
    LIMIT 5
  ) sub
  JOIN public.products p ON p.id = sub.product_id;

  RETURN json_build_object(
    'low_stock', v_low_stock,
    'top_debtors', v_top_debtors,
    'expense_spikes', v_expense_spikes,
    'top_selling', v_top_selling
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
