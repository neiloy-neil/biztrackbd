-- Multi-User RBAC & Audit Trails Migration

-- 1. Alter user_role ENUM to include 'staff'
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. Add audit columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create has_permission function for RLS
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_business_id uuid, p_permission text)
RETURNS boolean AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Get user role
  SELECT role INTO v_role 
  FROM public.business_members 
  WHERE user_id = p_user_id AND business_id = p_business_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owner has all permissions
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  -- Define permissions per role
  IF v_role = 'manager' THEN
    IF p_permission IN (
      'sales.create', 'sales.view', 'sales.edit',
      'expenses.create', 'expenses.view', 'expenses.edit',
      'customers.view', 'customers.manage',
      'suppliers.view', 'suppliers.manage',
      'products.manage', 'products.view',
      'inventory.manage',
      'reports.view', 'staff.view'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF v_role = 'cashier' THEN
    IF p_permission IN (
      'sales.create', 'sales.view',
      'customers.view', 'products.view'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF v_role = 'staff' THEN
    IF p_permission IN (
      'sales.view', 'customers.view', 'products.view'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Drop old generic policies
DROP POLICY IF EXISTS "Tenant isolation SELECT transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation INSERT transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation UPDATE transactions" ON public.transactions;

DROP POLICY IF EXISTS "Tenant isolation SELECT parties" ON public.parties;
DROP POLICY IF EXISTS "Tenant isolation INSERT parties" ON public.parties;
DROP POLICY IF EXISTS "Tenant isolation UPDATE parties" ON public.parties;

DROP POLICY IF EXISTS "Tenant isolation SELECT products" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation INSERT products" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation UPDATE products" ON public.products;

-- 5. Create new Granular RLS Policies

-- Transactions
CREATE POLICY "RBAC SELECT transactions" ON public.transactions FOR SELECT USING (
  public.has_permission(auth.uid(), business_id, 'sales.view') OR
  public.has_permission(auth.uid(), business_id, 'expenses.view') OR
  public.has_permission(auth.uid(), business_id, 'reports.view')
);

CREATE POLICY "RBAC INSERT transactions" ON public.transactions FOR INSERT WITH CHECK (
  (type IN ('sale', 'payment_in') AND public.has_permission(auth.uid(), business_id, 'sales.create')) OR
  (type IN ('expense', 'purchase', 'payment_out') AND public.has_permission(auth.uid(), business_id, 'expenses.create')) OR
  public.has_permission(auth.uid(), business_id, 'sales.create') -- fallback for edge cases
);

CREATE POLICY "RBAC UPDATE transactions" ON public.transactions FOR UPDATE USING (
  (type IN ('sale', 'payment_in') AND public.has_permission(auth.uid(), business_id, 'sales.edit')) OR
  (type IN ('expense', 'purchase', 'payment_out') AND public.has_permission(auth.uid(), business_id, 'expenses.edit'))
);

-- Parties
CREATE POLICY "RBAC SELECT parties" ON public.parties FOR SELECT USING (
  public.has_permission(auth.uid(), business_id, 'customers.view') OR
  public.has_permission(auth.uid(), business_id, 'suppliers.view')
);
CREATE POLICY "RBAC INSERT parties" ON public.parties FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), business_id, 'customers.manage') OR
  public.has_permission(auth.uid(), business_id, 'suppliers.manage')
);
CREATE POLICY "RBAC UPDATE parties" ON public.parties FOR UPDATE USING (
  public.has_permission(auth.uid(), business_id, 'customers.manage') OR
  public.has_permission(auth.uid(), business_id, 'suppliers.manage')
);

-- Products
CREATE POLICY "RBAC SELECT products" ON public.products FOR SELECT USING (
  public.has_permission(auth.uid(), business_id, 'products.view')
);
CREATE POLICY "RBAC INSERT products" ON public.products FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), business_id, 'products.manage')
);
CREATE POLICY "RBAC UPDATE products" ON public.products FOR UPDATE USING (
  public.has_permission(auth.uid(), business_id, 'products.manage')
);
