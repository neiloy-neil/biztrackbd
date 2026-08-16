-- Migration: Drop old schema and create Multi-tenant Financial SaaS Schema

-- 1. DROP EXISTING SCHEMA
DROP TRIGGER IF EXISTS on_transaction_created ON public.transactions;
DROP FUNCTION IF EXISTS public.process_transaction();

DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.parties CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;

DROP TYPE IF EXISTS public.transaction_type;
DROP TYPE IF EXISTS public.party_type;
DROP TYPE IF EXISTS public.wallet_type;

-- 2. ENUMS
CREATE TYPE public.user_role AS ENUM ('owner', 'manager', 'cashier');
CREATE TYPE public.party_type AS ENUM ('customer', 'supplier', 'both');
CREATE TYPE public.transaction_type AS ENUM ('sale', 'purchase', 'expense', 'income', 'transfer', 'payment_in', 'payment_out', 'opening_balance');
CREATE TYPE public.transaction_state AS ENUM ('pending', 'completed', 'cancelled', 'reversed');
CREATE TYPE public.inventory_movement_type AS ENUM ('in', 'out', 'adjustment');

-- 3. CORE MULTI-TENANCY
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text DEFAULT 'BDT' NOT NULL,
  timezone text DEFAULT 'Asia/Dhaka' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.user_role DEFAULT 'owner' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, user_id)
);

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. MASTER DATA (Soft Deletable)
CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type public.party_type NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  price numeric(19,4) NOT NULL DEFAULT 0,
  cost numeric(19,4) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- e.g., 'cash', 'bank', 'mobile_money'
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

-- 5. FINANCIAL LEDGER (Immutable)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
  party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT,
  type public.transaction_type NOT NULL,
  state public.transaction_state DEFAULT 'completed' NOT NULL,
  reference text,
  total_amount numeric(19,4) NOT NULL CHECK (total_amount >= 0),
  transaction_date date DEFAULT current_date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity numeric(19,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  subtotal numeric(19,4) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
  amount numeric(19,4) NOT NULL, -- Positive for debit (increase balance), Negative for credit (decrease balance)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 6. INVENTORY LEDGER (Immutable)
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  type public.inventory_movement_type NOT NULL,
  quantity numeric(19,4) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 7. AUDIT & SETTINGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  receipt_header text,
  receipt_footer text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 8. TRIGGERS FOR DEFAULT TENANT SETUP
-- Setup default branch and default business member upon new business creation
CREATE OR REPLACE FUNCTION public.handle_new_business()
RETURNS trigger AS $$
BEGIN
  -- Insert default branch
  INSERT INTO public.branches (business_id, name) VALUES (NEW.id, 'Main Branch');
  -- Insert default accounts
  INSERT INTO public.accounts (business_id, name, type) VALUES (NEW.id, 'Cash', 'cash');
  INSERT INTO public.accounts (business_id, name, type) VALUES (NEW.id, 'bKash', 'mobile_money');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_business_created
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_business();


-- Update the existing new_user trigger to create business_members properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_business_id uuid;
BEGIN
  -- 1. Create a default business for the user
  INSERT INTO public.businesses (name)
  VALUES ('My Business')
  RETURNING id INTO new_business_id;

  -- 2. Make the user the owner of the new business
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (new_business_id, new.id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. ROW LEVEL SECURITY (RLS)
CREATE OR REPLACE FUNCTION public.is_business_member(biz_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = biz_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies for businesses
CREATE POLICY "Users view joined businesses" ON public.businesses FOR SELECT USING (id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users insert businesses" ON public.businesses FOR INSERT WITH CHECK (true); -- Trigger handles member insert
CREATE POLICY "Owners update businesses" ON public.businesses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.business_members WHERE business_id = id AND user_id = auth.uid() AND role = 'owner')
);

-- Policies for business_members
CREATE POLICY "Users view members of joined businesses" ON public.business_members FOR SELECT USING (public.is_business_member(business_id));
CREATE POLICY "System insert members" ON public.business_members FOR INSERT WITH CHECK (true); -- Normally restricted in prod

-- Generalized Policy for all business_id tables (SELECT, INSERT, UPDATE)
DO $$ 
DECLARE
  table_name text;
BEGIN
  FOR table_name IN SELECT unnest(ARRAY['branches', 'parties', 'product_categories', 'products', 'accounts', 'settings', 'transactions', 'inventory_movements', 'audit_logs']) LOOP
    EXECUTE format('CREATE POLICY "Tenant isolation SELECT %s" ON public.%s FOR SELECT USING (public.is_business_member(business_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY "Tenant isolation INSERT %s" ON public.%s FOR INSERT WITH CHECK (public.is_business_member(business_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY "Tenant isolation UPDATE %s" ON public.%s FOR UPDATE USING (public.is_business_member(business_id))', table_name, table_name);
  END LOOP;
END $$;

-- Transaction Items (joins to transactions)
CREATE POLICY "Tenant isolation SELECT transaction_items" ON public.transaction_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_business_member(t.business_id))
);
CREATE POLICY "Tenant isolation INSERT transaction_items" ON public.transaction_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_business_member(t.business_id))
);

-- Account Transactions
CREATE POLICY "Tenant isolation SELECT account_transactions" ON public.account_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_business_member(t.business_id))
);
CREATE POLICY "Tenant isolation INSERT account_transactions" ON public.account_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_business_member(t.business_id))
);
