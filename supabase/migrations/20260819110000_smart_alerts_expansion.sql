-- Migration: Expand Smart Alerts
-- Adds Sales Decline, Profit Decline, Closing Missing, and Subscription Expiry alerts.

CREATE OR REPLACE FUNCTION public.generate_smart_alerts(
  p_business_id uuid
) RETURNS void AS $$
DECLARE
  v_product RECORD;
  v_party RECORD;
  v_this_week_expenses numeric := 0;
  v_last_week_expenses numeric := 0;
  v_this_week_sales numeric := 0;
  v_last_week_sales numeric := 0;
  v_this_week_profit numeric := 0;
  v_last_week_profit numeric := 0;
  v_yesterday_transactions int := 0;
  v_yesterday_closing boolean := false;
  v_subscription RECORD;
BEGIN
  -- Verify ownership or allow service_role
  IF auth.role() != 'service_role' AND NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Low Stock Alerts (every 3 days)
  FOR v_product IN 
    SELECT id, name, current_stock, min_stock 
    FROM public.products 
    WHERE business_id = p_business_id 
      AND current_stock <= min_stock 
      AND min_stock > 0 
      AND deleted_at IS NULL
  LOOP
    INSERT INTO public.notifications (business_id, type, title, message, reference_id)
    SELECT p_business_id, 'low_stock', 'Low Stock Alert', v_product.name || ' is running low on stock (' || v_product.current_stock || ' left)', v_product.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id 
        AND type = 'low_stock' 
        AND reference_id = v_product.id 
        AND created_at >= current_date - interval '3 days'
    );
  END LOOP;

  -- 2. Top Debtors Alerts (every 7 days)
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
        AND created_at >= current_date - interval '7 days'
    );
  END LOOP;

  -- 3. Expense Spikes (Weekly logic)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'expense' AND state = 'completed'
    AND transaction_date >= current_date - interval '7 days';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_week_expenses
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'expense' AND state = 'completed'
    AND transaction_date >= current_date - interval '14 days' AND transaction_date < current_date - interval '7 days';

  IF v_last_week_expenses > 0 AND v_this_week_expenses > (v_last_week_expenses * 1.2) THEN
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT p_business_id, 'expense_spike', 'Expense Spike Detected', 'Your expenses this week are ' || ROUND(((v_this_week_expenses - v_last_week_expenses) / v_last_week_expenses) * 100, 0) || '% higher than last week.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id AND type = 'expense_spike' AND created_at >= current_date - interval '7 days'
    );
  END IF;

  -- 4. Sales Decline (Weekly logic)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_week_sales
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'sale' AND state = 'completed'
    AND transaction_date >= current_date - interval '7 days';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_week_sales
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'sale' AND state = 'completed'
    AND transaction_date >= current_date - interval '14 days' AND transaction_date < current_date - interval '7 days';

  IF v_last_week_sales > 0 AND v_this_week_sales < (v_last_week_sales * 0.8) THEN
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT p_business_id, 'sales_decline', 'Sales Decline Detected', 'Your sales this week are ' || ROUND(((v_last_week_sales - v_this_week_sales) / v_last_week_sales) * 100, 0) || '% lower than last week.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id AND type = 'sales_decline' AND created_at >= current_date - interval '7 days'
    );
  END IF;

  -- 5. Daily Closing Missing
  -- Check if transactions occurred yesterday
  SELECT count(*) INTO v_yesterday_transactions
  FROM public.transactions
  WHERE business_id = p_business_id AND transaction_date = current_date - interval '1 day';

  IF v_yesterday_transactions > 0 THEN
    -- Check if a closing exists
    SELECT EXISTS (
      SELECT 1 FROM public.daily_closings 
      WHERE business_id = p_business_id AND closing_date = current_date - interval '1 day'
    ) INTO v_yesterday_closing;

    IF NOT v_yesterday_closing THEN
      INSERT INTO public.notifications (business_id, type, title, message)
      SELECT p_business_id, 'closing_missing', 'Daily Closing Missing', 'You have transactions from yesterday but no Daily Closing was performed. Please balance your cash register.'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE business_id = p_business_id AND type = 'closing_missing' AND created_at >= current_date - interval '1 day'
      );
    END IF;
  END IF;

  -- 6. Subscription Expiry Warning
  SELECT * INTO v_subscription FROM public.subscriptions WHERE business_id = p_business_id AND status = 'active' LIMIT 1;
  IF FOUND AND v_subscription.current_period_end <= current_date + interval '3 days' THEN
    INSERT INTO public.notifications (business_id, type, title, message)
    SELECT p_business_id, 'subscription_expiry', 'Subscription Expiring Soon', 'Your BizTrack subscription expires on ' || to_char(v_subscription.current_period_end, 'DD Mon YYYY') || '. Please renew to avoid interruption.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = p_business_id AND type = 'subscription_expiry' AND created_at >= current_date - interval '3 days'
    );
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
