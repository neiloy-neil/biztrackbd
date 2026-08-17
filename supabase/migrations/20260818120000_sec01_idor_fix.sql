-- SEC-01 Cross-Tenant IDOR Remediation
-- Four INSERT policies validated parent business membership but not FK targets.
-- This migration adds cross-tenant checks and hardens the stock trigger.


-- 1. Harden is_business_member: STABLE + fixed search_path
CREATE OR REPLACE FUNCTION public.is_business_member(biz_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = biz_id
      AND user_id = auth.uid()
  );
END;
$$;


-- 2. inventory_movements INSERT: also validate product belongs to same business
DROP POLICY IF EXISTS "Tenant isolation INSERT inventory_movements" ON public.inventory_movements;

CREATE POLICY "Tenant isolation INSERT inventory_movements"
  ON public.inventory_movements
  FOR INSERT
  WITH CHECK (
    public.is_business_member(business_id)
    AND EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_id
        AND business_id = inventory_movements.business_id
    )
  );


-- 3. Harden set_inventory_movement_balances: fail if product is cross-tenant
CREATE OR REPLACE FUNCTION public.set_inventory_movement_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_qty NUMERIC(19,4);
  product_biz UUID;
BEGIN
  SELECT business_id INTO product_biz
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF product_biz IS NULL OR product_biz <> NEW.business_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: product % does not belong to business %',
      NEW.product_id, NEW.business_id;
  END IF;

  SELECT current_stock INTO current_qty
  FROM public.products
  WHERE id = NEW.product_id;

  NEW.before_quantity := current_qty;

  IF NEW.type = 'in' THEN
    NEW.after_quantity := current_qty + NEW.quantity;
  ELSIF NEW.type = 'out' THEN
    NEW.after_quantity := current_qty - NEW.quantity;
  ELSIF NEW.type = 'adjustment' THEN
    NEW.after_quantity := current_qty + NEW.quantity;
  END IF;

  UPDATE public.products
  SET current_stock = NEW.after_quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;


-- 4. account_transactions INSERT: also validate account belongs to same business
DROP POLICY IF EXISTS "Tenant isolation INSERT account_transactions" ON public.account_transactions;

CREATE POLICY "Tenant isolation INSERT account_transactions"
  ON public.account_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.is_business_member(t.business_id)
        AND EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = account_id
            AND a.business_id = t.business_id
        )
    )
  );


-- 5. transaction_items INSERT: also validate product belongs to same business
DROP POLICY IF EXISTS "Tenant isolation INSERT transaction_items" ON public.transaction_items;

CREATE POLICY "Tenant isolation INSERT transaction_items"
  ON public.transaction_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.is_business_member(t.business_id)
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_id
            AND p.business_id = t.business_id
        )
    )
  );


-- 6. transactions INSERT: also validate party_id belongs to same business
-- Original policy name from 20260816120000_rbac_and_audit.sql is "RBAC INSERT transactions"
DROP POLICY IF EXISTS "RBAC INSERT transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation INSERT transactions" ON public.transactions;

CREATE POLICY "RBAC INSERT transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (
    public.is_business_member(business_id)
    AND (
      party_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.parties
        WHERE id = party_id
          AND business_id = transactions.business_id
      )
    )
  );
