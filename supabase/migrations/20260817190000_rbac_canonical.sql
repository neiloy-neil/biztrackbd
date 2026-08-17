-- =============================================================
-- Migration: Canonical RBAC — single source of truth (P1-B)
--
-- Previously the DB has_permission() function and the TypeScript
-- ROLE_PERMISSIONS map had diverged:
--
--   manager missing in DB: staff.manage, settings.manage, closing.manage
--   cashier missing in DB: closing.manage
--
-- This caused a real bug: server actions (TypeScript check) allowed
-- those operations, but RLS policies (DB function) silently blocked
-- the underlying INSERT/UPDATE, causing cryptic failures.
--
-- Fix: rewrite has_permission() as the single authoritative source.
-- The TypeScript map in safe-action.ts is updated to mirror this
-- function exactly, so the two layers are always consistent.
--
-- Canonical permission matrix:
--
--   Permission        | owner | manager | cashier | staff
--   ------------------+-------+---------+---------+------
--   sales.create      |  ✓   |    ✓    |    ✓    |
--   sales.view        |  ✓   |    ✓    |    ✓    |  ✓
--   sales.edit        |  ✓   |    ✓    |         |
--   expenses.create   |  ✓   |    ✓    |         |
--   expenses.view     |  ✓   |    ✓    |         |
--   expenses.edit     |  ✓   |    ✓    |         |
--   customers.view    |  ✓   |    ✓    |    ✓    |  ✓
--   customers.manage  |  ✓   |    ✓    |         |
--   suppliers.view    |  ✓   |    ✓    |         |
--   suppliers.manage  |  ✓   |    ✓    |         |
--   products.view     |  ✓   |    ✓    |    ✓    |  ✓
--   products.manage   |  ✓   |    ✓    |         |
--   inventory.manage  |  ✓   |    ✓    |         |
--   reports.view      |  ✓   |    ✓    |         |
--   staff.view        |  ✓   |    ✓    |         |
--   staff.manage      |  ✓   |    ✓    |         |
--   settings.manage   |  ✓   |    ✓    |         |
--   closing.manage    |  ✓   |    ✓    |    ✓    |
-- =============================================================

CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id     uuid,
  p_business_id uuid,
  p_permission  text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
    FROM public.business_members
   WHERE user_id = p_user_id
     AND business_id = p_business_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owner has every permission
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  IF v_role = 'manager' THEN
    RETURN p_permission IN (
      'sales.create',    'sales.view',      'sales.edit',
      'expenses.create', 'expenses.view',   'expenses.edit',
      'customers.view',  'customers.manage',
      'suppliers.view',  'suppliers.manage',
      'products.view',   'products.manage',
      'inventory.manage',
      'reports.view',
      'staff.view',      'staff.manage',
      'settings.manage',
      'closing.manage'
    );
  END IF;

  IF v_role = 'cashier' THEN
    RETURN p_permission IN (
      'sales.create', 'sales.view',
      'customers.view',
      'products.view',
      'closing.manage'
    );
  END IF;

  IF v_role = 'staff' THEN
    RETURN p_permission IN (
      'sales.view',
      'customers.view',
      'products.view'
    );
  END IF;

  RETURN false;
END;
$$;
