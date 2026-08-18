-- Migration: Smart Alerts Generation
-- Creates the RPC to generate smart alerts (idempotent, won't duplicate unread alerts)

CREATE OR REPLACE FUNCTION public.generate_smart_alerts(
  p_business_id uuid
) RETURNS void AS $$
DECLARE
  v_product RECORD;
  v_party RECORD;
  v_this_week_expenses numeric;
  v_last_week_expenses numeric;
BEGIN
  -- Verify ownership or allow service_role
  IF auth.role() != 'service_role' AND NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Low Stock Alerts
  FOR v_product IN 
    SELECT id, name, current_stock, min_stock 
    FROM public.products 
    WHERE business_id = p_business_id 
      AND current_stock <= min_stock 
      AND min_stock > 0 
      AND deleted_at IS NULL
  LOOP
    -- Insert only if an unread notification doesn't already exist for this product
    INSERT INTO public.notifications (business_id, type, title, message, reference_id)
    SELECT p_business_id, 'low_stock', 'Low Stock Alert', v_product.name || ' is running low on stock (' || v_product.current_stock || ' left)', v_product.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id 
        AND type = 'low_stock' 
        AND reference_id = v_product.id 
        AND is_read = false
    );
  END LOOP;

  -- 2. Top Debtors Alerts
  FOR v_party IN 
    SELECT id, name, current_due 
    FROM public.parties 
    WHERE business_id = p_business_id 
      AND type IN ('customer', 'both') 
      AND current_due > 0 
      AND deleted_at IS NULL 
    ORDER BY current_due DESC 
    LIMIT 5
  LOOP
    INSERT INTO public.notifications (business_id, type, title, message, reference_id)
    SELECT p_business_id, 'overdue_due', 'High Outstanding Due', v_party.name || ' owes ৳' || v_party.current_due, v_party.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id 
        AND type = 'overdue_due' 
        AND reference_id = v_party.id 
        AND is_read = false
    );
  END LOOP;

  -- 3. Expense Spikes (Optional: Generate once a week or on demand)
  -- For now, we compare this week to last week
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

  IF v_last_week_expenses > 0 AND v_this_week_expenses > (v_last_week_expenses * 1.2) THEN -- 20% spike
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT p_business_id, 'expense_spike', 'Expense Spike Detected', 'Your expenses this week are ' || ROUND(((v_this_week_expenses - v_last_week_expenses) / v_last_week_expenses) * 100, 0) || '% higher than last week.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id 
        AND type = 'expense_spike'
        AND is_read = false
        AND created_at >= current_date - interval '3 days' -- Prevent spamming spike alerts every day
    );
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
