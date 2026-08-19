-- Migration: Sprint 12 Notification System Rebuild

-- 1. Create user_notification_reads join table for per-user read tracking
CREATE TABLE public.user_notification_reads (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);

ALTER TABLE public.user_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own notification reads"
  ON public.user_notification_reads FOR ALL
  USING (auth.uid() = user_id);

-- 2. Drop the old global is_read column from notifications
-- We don't need it anymore. This might break generate_smart_alerts momentarily.
ALTER TABLE public.notifications DROP COLUMN is_read;

-- 3. Update generate_smart_alerts RPC to prevent spamming without relying on is_read.
-- We will instead check if a notification of the same type and reference_id was generated in the last 7 days.
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
    -- Insert only if a notification hasn't been generated in the last 3 days
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
        AND created_at >= current_date - interval '7 days'
    );
  END LOOP;

  -- 3. Expense Spikes (Optional: Generate once a week or on demand)
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
        AND created_at >= current_date - interval '3 days'
    );
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Fix the existing trigger_check_low_stock to insert into tenant notifications
CREATE OR REPLACE FUNCTION public.check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  biz_name TEXT;
BEGIN
  -- Only trigger if stock crossed the threshold downwards
  IF NEW.current_stock <= NEW.min_stock AND OLD.current_stock > OLD.min_stock AND NEW.min_stock > 0 THEN
    
    -- Insert into tenant notifications, but only if one hasn't been sent recently
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE business_id = NEW.business_id 
        AND type = 'low_stock' 
        AND reference_id = NEW.id 
        AND created_at >= current_date - interval '3 days'
    ) THEN
      INSERT INTO public.notifications (business_id, type, title, message, reference_id)
      VALUES (
        NEW.business_id,
        'low_stock',
        'Low Stock Alert: ' || NEW.name,
        NEW.name || ' is running low on stock (' || NEW.current_stock || ' left)',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper RPC to get unread notifications for a user
CREATE OR REPLACE FUNCTION public.get_unread_notifications(
  p_business_id uuid,
  p_user_id uuid
) RETURNS SETOF public.notifications AS $$
BEGIN
  RETURN QUERY
  SELECT n.*
  FROM public.notifications n
  LEFT JOIN public.user_notification_reads r 
    ON n.id = r.notification_id AND r.user_id = p_user_id
  WHERE n.business_id = p_business_id
    AND r.user_id IS NULL
  ORDER BY n.created_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
