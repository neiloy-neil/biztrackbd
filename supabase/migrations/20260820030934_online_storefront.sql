-- 1. Add new enum values for online orders
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'online_order';
ALTER TYPE public.transaction_state ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.transaction_state ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE public.transaction_state ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.transaction_state ADD VALUE IF NOT EXISTS 'returned';

-- 2. Create Storefront Profiles
CREATE TABLE IF NOT EXISTS public.storefront_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug text UNIQUE NOT NULL CHECK (char_length(slug) >= 3 AND slug ~ '^[a-z0-9-]+$'),
  theme_color text DEFAULT '#007AFF' NOT NULL,
  logo_url text,
  banner_url text,
  is_active boolean DEFAULT true NOT NULL,
  flat_delivery_fee numeric(19,4) DEFAULT 60.00 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Modify Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_published_online boolean DEFAULT false NOT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS online_price numeric(19,4);

-- 4. Create Shipments Table for Online Orders
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  courier_name text,
  tracking_number text,
  shipping_cost numeric(19,4) DEFAULT 0 NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_address text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered', 'returned', 'cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Set up RLS for Storefront (Public Access)
ALTER TABLE public.storefront_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to active storefronts
CREATE POLICY "Public can view active storefronts" 
  ON public.storefront_profiles FOR SELECT 
  USING (is_active = true);

-- Allow anonymous read access to published products for active storefronts
CREATE POLICY "Public can view published products" 
  ON public.products FOR SELECT 
  USING (
    is_published_online = true 
    AND EXISTS (
      SELECT 1 FROM public.storefront_profiles sp 
      WHERE sp.business_id = products.business_id AND sp.is_active = true
    )
  );

-- Business owner policies for new tables
CREATE POLICY "Business members can manage storefront" 
  ON public.storefront_profiles FOR ALL 
  USING (is_business_member(business_id));

CREATE POLICY "Business members can manage shipments" 
  ON public.shipments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t 
      WHERE t.id = shipments.transaction_id AND is_business_member(t.business_id)
    )
  );

-- 6. RPC: Submit Online Order (Security Definer to bypass RLS for inserts by public)
CREATE OR REPLACE FUNCTION public.submit_online_order(
  p_business_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_items jsonb, -- Array of { product_id, variant_id, quantity, unit_price, subtotal }
  p_total_amount numeric,
  p_delivery_fee numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_party_id uuid;
  v_transaction_id uuid;
  v_branch_id uuid;
  v_item record;
BEGIN
  -- 1. Get the default branch for the business
  SELECT id INTO v_branch_id FROM public.branches WHERE business_id = p_business_id AND is_default = true LIMIT 1;
  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id FROM public.branches WHERE business_id = p_business_id LIMIT 1;
  END IF;

  -- 2. Find or Create Customer Party based on phone number
  SELECT id INTO v_party_id FROM public.parties WHERE business_id = p_business_id AND phone = p_customer_phone AND type = 'customer' LIMIT 1;
  
  IF v_party_id IS NULL THEN
    INSERT INTO public.parties (business_id, name, phone, type, current_due)
    VALUES (p_business_id, p_customer_name, p_customer_phone, 'customer', 0)
    RETURNING id INTO v_party_id;
  END IF;

  -- 3. Create the pending transaction
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, total_amount, notes
  ) VALUES (
    p_business_id, v_branch_id, v_party_id, 'online_order', 'pending', p_total_amount, 'Online Order via Storefront'
  ) RETURNING id INTO v_transaction_id;

  -- 4. Create transaction items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric, unit_price numeric, subtotal numeric) LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.subtotal
    );
  END LOOP;

  -- 5. Create shipment record
  INSERT INTO public.shipments (
    transaction_id, shipping_cost, customer_name, customer_phone, delivery_address, status
  ) VALUES (
    v_transaction_id, p_delivery_fee, p_customer_name, p_customer_phone, p_delivery_address, 'pending'
  );

  -- Note: We DO NOT create account_transactions or inventory_movements yet.
  -- That happens when the business owner marks the order as shipped/paid.

  RETURN v_transaction_id;
END;
$$;
