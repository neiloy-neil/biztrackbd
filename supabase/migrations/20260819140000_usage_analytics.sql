-- Migration: Platform Usage Analytics

-- 1. Unit Costs Table
-- Defines how much the platform pays for specific infrastructural units.
CREATE TABLE public.platform_unit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  cost_per_unit numeric(19,4) NOT NULL DEFAULT 0,
  unit_size integer NOT NULL DEFAULT 1, -- e.g., cost_per_unit is per 1000 transactions
  currency text DEFAULT 'BDT' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Seed some default base costs
INSERT INTO public.platform_unit_costs (feature_key, cost_per_unit, unit_size) VALUES
  ('transactions', 10, 1000), -- 10 BDT per 1000 transactions (DB cost proxy)
  ('products', 5, 1000), -- 5 BDT per 1000 products (Storage/DB proxy)
  ('sms', 0.50, 1), -- 0.50 BDT per 1 SMS
  ('email', 5, 1000), -- 5 BDT per 1000 emails
  ('ai_requests', 2, 10) -- 2 BDT per 10 AI queries
ON CONFLICT (feature_key) DO NOTHING;

-- 2. Materialized View for fast analytics
-- (Using a standard view for real-time simplicity, since the scale is manageable. 
-- Can be converted to MATERIALIZED VIEW if it gets too slow).

CREATE OR REPLACE VIEW public.vw_business_usage_stats AS
SELECT 
  b.id AS business_id,
  b.name AS business_name,
  s.plan_id,
  p.name AS plan_name,
  p.price_monthly AS mrr,
  
  -- Metrics
  (SELECT count(*) FROM public.transactions t WHERE t.business_id = b.id) AS total_transactions,
  (SELECT count(*) FROM public.products pr WHERE pr.business_id = b.id) AS total_products,
  (SELECT sum(usage_count) FROM public.usage_records ur WHERE ur.business_id = b.id AND ur.feature_key = 'sms') AS total_sms,
  (SELECT sum(usage_count) FROM public.usage_records ur WHERE ur.business_id = b.id AND ur.feature_key = 'ai_requests') AS total_ai_requests,
  
  -- Rough cost estimate based on unit costs
  (
    COALESCE((SELECT count(*) FROM public.transactions t WHERE t.business_id = b.id)::numeric / NULLIF((SELECT unit_size FROM public.platform_unit_costs WHERE feature_key = 'transactions'), 0) * (SELECT cost_per_unit FROM public.platform_unit_costs WHERE feature_key = 'transactions'), 0) +
    COALESCE((SELECT count(*) FROM public.products pr WHERE pr.business_id = b.id)::numeric / NULLIF((SELECT unit_size FROM public.platform_unit_costs WHERE feature_key = 'products'), 0) * (SELECT cost_per_unit FROM public.platform_unit_costs WHERE feature_key = 'products'), 0) +
    COALESCE((SELECT sum(usage_count) FROM public.usage_records ur WHERE ur.business_id = b.id AND ur.feature_key = 'sms')::numeric / NULLIF((SELECT unit_size FROM public.platform_unit_costs WHERE feature_key = 'sms'), 0) * (SELECT cost_per_unit FROM public.platform_unit_costs WHERE feature_key = 'sms'), 0) +
    COALESCE((SELECT sum(usage_count) FROM public.usage_records ur WHERE ur.business_id = b.id AND ur.feature_key = 'ai_requests')::numeric / NULLIF((SELECT unit_size FROM public.platform_unit_costs WHERE feature_key = 'ai_requests'), 0) * (SELECT cost_per_unit FROM public.platform_unit_costs WHERE feature_key = 'ai_requests'), 0)
  ) AS estimated_cost
  
FROM public.businesses b
LEFT JOIN public.subscriptions s ON s.business_id = b.id AND s.status = 'active'
LEFT JOIN public.plans p ON p.id = s.plan_id;
