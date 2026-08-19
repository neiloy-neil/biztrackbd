-- get_actionable_insights had ORDER BY pt.current_due DESC LIMIT 5 at the outer
-- SELECT level alongside json_agg() with no GROUP BY, causing error 42803.
-- Fix: wrap the filtered/ordered/limited rows in a subquery before aggregating.
CREATE OR REPLACE FUNCTION public.get_actionable_insights(p_business_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

  -- Subquery orders/limits first; outer json_agg has no bare non-aggregated columns
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', pt.id,
      'name', pt.name,
      'phone', pt.phone,
      'current_due', pt.current_due
    )
  ), '[]'::json) INTO v_top_debtors
  FROM (
    SELECT id, name, phone, current_due
    FROM public.v_party_balances
    WHERE business_id = p_business_id
      AND type IN ('customer', 'both')
      AND current_due > 0
    ORDER BY current_due DESC
    LIMIT 5
  ) pt;

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
$function$;
