-- Migration: Phase 5 Operations & Backend Tooling

-- ==========================================
-- 1. ADMIN NOTIFICATION READS
-- ==========================================
CREATE TABLE public.admin_notification_reads (
  admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.platform_notifications(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (admin_id, notification_id)
);

ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own notification reads" ON public.admin_notification_reads 
FOR ALL USING (public.is_platform_admin() AND auth.uid() = admin_id);

-- Remove the old shared is_read column (we can do this safely as notifications will just show as unread)
ALTER TABLE public.platform_notifications DROP COLUMN IF EXISTS is_read;

-- ==========================================
-- 2. LOW STOCK TRIGGER
-- ==========================================
-- Triggers a notification when a product's stock falls to or below min_stock
CREATE OR REPLACE FUNCTION public.check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  biz_name TEXT;
BEGIN
  -- Only trigger if stock crossed the threshold downwards
  IF NEW.current_stock <= NEW.min_stock AND OLD.current_stock > OLD.min_stock THEN
    -- Get business name for context
    SELECT name INTO biz_name FROM public.businesses WHERE id = NEW.business_id;
    
    INSERT INTO public.platform_notifications (type, priority, title, message, target_url, metadata)
    VALUES (
      'system_incident', 
      'high', 
      'Low Stock Alert: ' || NEW.name, 
      biz_name || ' has low stock for ' || NEW.name || '. Current stock: ' || NEW.current_stock || ' ' || NEW.unit,
      '/admin/businesses/' || NEW.business_id,
      jsonb_build_object('product_id', NEW.id, 'business_id', NEW.business_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_low_stock ON public.products;
CREATE TRIGGER trigger_check_low_stock
  AFTER UPDATE OF current_stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_low_stock();


-- ==========================================
-- 3. AUDIT LOGGING HELPER
-- ==========================================
-- A helper function to easily log sensitive reads from the server side without bypassing RLS manually every time.
-- This is SECURITY DEFINER so that the server action can call it, but it restricts inserts to authenticated users.
CREATE OR REPLACE FUNCTION public.log_sensitive_read(target_type text, target_id text, action_desc text)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.platform_audit_logs (actor_id, action, target_type, target_id, ip_address)
  VALUES (
    auth.uid(),
    action_desc,
    target_type,
    target_id,
    -- We can't easily get the real IP here in Supabase triggers without checking headers, so we leave it null for RPC
    NULL 
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
