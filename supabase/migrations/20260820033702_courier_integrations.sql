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
