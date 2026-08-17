-- =============================================================
-- Fix Transaction RLS — Remove sales.create fallback
--
-- The previous INSERT policy had an unconditional fallback:
--   public.has_permission(..., 'sales.create')
-- which allowed any user with sales.create to INSERT any
-- transaction type (income, transfer, opening_balance, purchase)
-- by hitting the Data API directly, bypassing server actions.
--
-- Fix: explicit rule for every type in the enum. No fallback.
--
-- transaction_type enum:
--   sale, payment_in, income   → sales.create
--   expense, payment_out       → expenses.create
--   purchase                   → inventory.manage
--   transfer                   → owner or manager only
--   opening_balance            → owner only (initial setup)
-- =============================================================

-- ============================================================
-- INSERT policy — drop and replace with explicit per-type rules
-- ============================================================
DROP POLICY IF EXISTS "RBAC INSERT transactions" ON public.transactions;

CREATE POLICY "RBAC INSERT transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    (
      type IN ('sale', 'payment_in', 'income')
      AND public.has_permission(auth.uid(), business_id, 'sales.create')
    )
    OR (
      type IN ('expense', 'payment_out')
      AND public.has_permission(auth.uid(), business_id, 'expenses.create')
    )
    OR (
      type = 'purchase'
      AND public.has_permission(auth.uid(), business_id, 'inventory.manage')
    )
    OR (
      type = 'transfer'
      AND EXISTS (
        SELECT 1 FROM public.business_members
        WHERE user_id = auth.uid()
          AND business_id = transactions.business_id
          AND role IN ('owner', 'manager')
      )
    )
    OR (
      type = 'opening_balance'
      AND EXISTS (
        SELECT 1 FROM public.business_members
        WHERE user_id = auth.uid()
          AND business_id = transactions.business_id
          AND role = 'owner'
      )
    )
  );


-- ============================================================
-- UPDATE policy — also plug the same gaps.
-- The old policy silently dropped 'income', 'transfer', and
-- 'opening_balance', meaning those rows could not be updated
-- at all (good for opening_balance, wrong for income/transfer).
-- ============================================================
DROP POLICY IF EXISTS "RBAC UPDATE transactions" ON public.transactions;

CREATE POLICY "RBAC UPDATE transactions" ON public.transactions
  FOR UPDATE USING (
    (
      type IN ('sale', 'payment_in', 'income')
      AND public.has_permission(auth.uid(), business_id, 'sales.edit')
    )
    OR (
      type IN ('expense', 'payment_out')
      AND public.has_permission(auth.uid(), business_id, 'expenses.edit')
    )
    OR (
      type = 'purchase'
      AND public.has_permission(auth.uid(), business_id, 'inventory.manage')
    )
    OR (
      type = 'transfer'
      AND EXISTS (
        SELECT 1 FROM public.business_members
        WHERE user_id = auth.uid()
          AND business_id = transactions.business_id
          AND role IN ('owner', 'manager')
      )
    )
    -- opening_balance is intentionally excluded: immutable after creation
  );
