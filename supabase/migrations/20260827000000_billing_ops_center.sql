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
