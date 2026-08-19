-- ==========================================
-- VAT & MUSHAK 6.3 ARCHITECTURE MIGRATION
-- ==========================================

-- 1. Business Tax Profiles
CREATE TABLE IF NOT EXISTS public.business_tax_profiles (
    business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
    vat_enabled boolean DEFAULT false,
    tin text,
    bin text,
    default_vat_rate numeric DEFAULT 0,
    default_pricing_model text DEFAULT 'exclusive',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_tax_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their business tax profile"
  ON public.business_tax_profiles
  FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Owners and Managers can update tax profile"
  ON public.business_tax_profiles
  FOR ALL
  USING (public.has_permission(auth.uid(), business_id, 'settings.manage'));

-- Add a trigger to automatically create a tax profile when a business is created
CREATE OR REPLACE FUNCTION public.create_default_tax_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.business_tax_profiles (business_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists so we can recreate
DROP TRIGGER IF EXISTS trg_create_default_tax_profile ON public.businesses;
CREATE TRIGGER trg_create_default_tax_profile
AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.create_default_tax_profile();

-- Backfill existing businesses
INSERT INTO public.business_tax_profiles (business_id)
SELECT id FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;

-- 2. Extend Products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tax_meta jsonb DEFAULT '{}'::jsonb;

-- 3. Extend Parties (Customers/Suppliers)
ALTER TABLE public.parties 
ADD COLUMN IF NOT EXISTS tax_meta jsonb DEFAULT '{}'::jsonb;

-- 4. Extend Invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS tax_invoice_number text,
ADD COLUMN IF NOT EXISTS mushak_reference text,
ADD COLUMN IF NOT EXISTS pricing_model_applied text,
ADD COLUMN IF NOT EXISTS total_taxable_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vat_amount numeric DEFAULT 0;

-- 5. Extend Invoice Items
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS taxable_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;

-- 6. Sequence Generator for Tax Invoice Number
-- We create a table to track sequences per business
CREATE TABLE IF NOT EXISTS public.tax_invoice_sequences (
    business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
    last_value integer DEFAULT 0,
    prefix text DEFAULT 'INV-'
);

ALTER TABLE public.tax_invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_tax_invoice_number(p_business_id uuid)
RETURNS text AS $$
DECLARE
  v_seq RECORD;
  v_new_val integer;
  v_year text;
BEGIN
  v_year := to_char(current_date, 'YY');
  
  -- Upsert to get lock
  INSERT INTO public.tax_invoice_sequences (business_id, last_value, prefix)
  VALUES (p_business_id, 1, 'INV-' || v_year || '-')
  ON CONFLICT (business_id) DO UPDATE 
  SET last_value = public.tax_invoice_sequences.last_value + 1
  RETURNING * INTO v_seq;

  RETURN v_seq.prefix || LPAD(v_seq.last_value::text, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
