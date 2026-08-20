


-- ==========================================
-- Admin Billing Operations Center
-- ==========================================

CREATE TABLE IF NOT EXISTS public.platform_payment_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    provider text NOT NULL,
    transaction_id text,
    operation_type text NOT NULL CHECK (operation_type IN ('charge', 'refund', 'credit')),
    amount numeric NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    failure_reason text,
    webhook_payload jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.platform_payment_operations ENABLE ROW LEVEL SECURITY;

-- Admins with billing manage/view access can see operations
CREATE POLICY "Admins view payment operations" ON public.platform_payment_operations
FOR SELECT USING (
    public.has_platform_permission('platform.billing.view') OR 
    public.has_platform_permission('platform.billing.manage')
);

CREATE POLICY "Admins manage payment operations" ON public.platform_payment_operations
FOR ALL USING (
    public.has_platform_permission('platform.billing.manage')
);


-- ==========================================
-- Admin Billing Analytics Views
-- ==========================================

CREATE OR REPLACE VIEW public.admin_mrr_metrics AS
SELECT 
    COALESCE(SUM(
        CASE 
            WHEN s.billing_cycle = 'monthly' THEN p.price_monthly
            WHEN s.billing_cycle = 'annual' THEN p.price_annual / 12.0
            ELSE 0
        END
    ), 0) AS total_mrr,
    COALESCE(SUM(
        CASE 
            WHEN s.billing_cycle = 'monthly' THEN p.price_monthly * 12.0
            WHEN s.billing_cycle = 'annual' THEN p.price_annual
            ELSE 0
        END
    ), 0) AS total_arr,
    COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_subscriptions,
    COUNT(s.id) FILTER (WHERE s.status = 'trialing') AS trialing_subscriptions,
    COUNT(s.id) FILTER (WHERE s.status = 'past_due') AS past_due_subscriptions,
    COUNT(s.id) FILTER (WHERE s.status = 'canceled') AS canceled_subscriptions
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE s.status IN ('active', 'past_due', 'trialing');

-- Secure the view
GRANT SELECT ON public.admin_mrr_metrics TO authenticated, anon;


-- 1. Create business integrations table
CREATE TABLE IF NOT EXISTS public.business_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('pathao', 'steadfast')),
  api_key text NOT NULL,
  api_secret text,
  store_id text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, provider)
);

-- 2. Enable RLS
ALTER TABLE public.business_integrations ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS Policies
-- Only owners can manage API integrations
CREATE POLICY "Owners can manage business integrations" 
  ON public.business_integrations FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = business_integrations.business_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
    )
  );

-- 4. Modify shipments table to store courier IDs
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS courier_consignment_id text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS courier_tracking_link text;


-- ==========================================
-- 3. HARDENED SUBSCRIPTION RENEWALS CRON
-- ==========================================
CREATE OR REPLACE FUNCTION public.process_subscription_renewals()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS 
  DECLARE
    v_sub record;
    v_plan record;
    v_amount numeric;
    v_count_invoices integer := 0;
    v_count_past_due integer := 0;
    v_count_unpaid integer := 0;
    v_count_cancelled integer := 0;
  BEGIN
    -- 1. Create renewal invoices for active subscriptions expiring in <= 7 days
    FOR v_sub IN 
      SELECT s.* 
      FROM public.subscriptions s
      WHERE s.status = 'active'
        AND s.cancel_at_period_end = false
        AND s.current_period_end <= now() + interval '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.invoices i 
          WHERE i.subscription_id = s.id 
            AND i.status IN ('draft', 'open')
        )
    LOOP
      SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
      
      IF v_sub.billing_cycle = 'annual' THEN
        v_amount := v_plan.price_annual;
      ELSE
        v_amount := v_plan.price_monthly;
      END IF;

      INSERT INTO public.invoices (
        business_id, subscription_id, amount_due, status, due_date
      ) VALUES (
        v_sub.business_id, v_sub.id, v_amount, 'open', v_sub.current_period_end
      );
      
      v_count_invoices := v_count_invoices + 1;
    END LOOP;

    -- 1b. Transition to cancelled if cancel_at_period_end is true and period ended
    WITH updated AS (
      UPDATE public.subscriptions
      SET status = 'cancelled', updated_at = now()
      WHERE status = 'active' AND cancel_at_period_end = true AND current_period_end < now()
      RETURNING id
    )
    SELECT count(*) INTO v_count_cancelled FROM updated;

    -- 2. Transition active -> past_due for lapsed subscriptions (that are not cancelling)
    WITH updated AS (
      UPDATE public.subscriptions
      SET status = 'past_due', updated_at = now()
      WHERE status = 'active' AND cancel_at_period_end = false AND current_period_end < now()
      RETURNING id
    )
    SELECT count(*) INTO v_count_past_due FROM updated;

    -- 3. Transition past_due -> unpaid (suspend) after 7-day grace period
    WITH updated AS (
      UPDATE public.subscriptions
      SET status = 'unpaid', updated_at = now()
      WHERE status = 'past_due' AND current_period_end < now() - interval '7 days'
      RETURNING id
    )
    SELECT count(*) INTO v_count_unpaid FROM updated;

    RETURN jsonb_build_object(
      'ok', true, 
      'invoices_created', v_count_invoices,
      'marked_cancelled', v_count_cancelled,
      'marked_past_due', v_count_past_due,
      'marked_unpaid', v_count_unpaid
    );
  END;
  ;
