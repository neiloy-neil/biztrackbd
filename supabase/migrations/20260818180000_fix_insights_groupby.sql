-- Fix get_actionable_insights: move ORDER BY + LIMIT inside subqueries so they
-- don't conflict with the outer json_agg aggregate (PostgreSQL error 42803).

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
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Low Stock Alerts
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'current_stock', sub.current_stock,
      'min_stock', sub.min_stock
    )
  ), '[]'::json) INTO v_low_stock
  FROM (
    SELECT id, name, current_stock, min_stock
    FROM public.products
    WHERE business_id = p_business_id
      AND current_stock <= min_stock
      AND min_stock > 0
      AND deleted_at IS NULL
    LIMIT 5
  ) sub;

  -- 2. Top Debtors (ORDER BY inside subquery avoids aggregate/non-aggregate conflict)
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'phone', sub.phone,
      'current_due', sub.current_due
    )
  ), '[]'::json) INTO v_top_debtors
  FROM (
    SELECT id, name, phone, current_due
    FROM public.parties
    WHERE business_id = p_business_id
      AND type IN ('customer', 'both')
      AND current_due > 0
      AND deleted_at IS NULL
    ORDER BY current_due DESC
    LIMIT 5
  ) sub;

  -- 3. Expense Spikes
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
      'name', sub.name,
      'total_sold', sub.total_sold
    )
  ), '[]'::json) INTO v_top_selling
  FROM (
    SELECT im.product_id, p.name, SUM(im.quantity) as total_sold
    FROM public.inventory_movements im
    JOIN public.products p ON p.id = im.product_id
    WHERE im.business_id = p_business_id
      AND im.type = 'out'
      AND im.created_at >= current_date - interval '30 days'
    GROUP BY im.product_id, p.name
    ORDER BY total_sold DESC
    LIMIT 5
  ) sub;

  RETURN json_build_object(
    'low_stock', v_low_stock,
    'top_debtors', v_top_debtors,
    'expense_spikes', v_expense_spikes,
    'top_selling', v_top_selling
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
