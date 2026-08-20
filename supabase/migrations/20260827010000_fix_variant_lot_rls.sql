-- Fix product_variants and inventory_lots RLS policies that referenced
-- get_current_business_id() -- a function that was never defined.
-- Any query joining these tables (e.g. POS product fetch) received an
-- error, causing products to silently disappear from the POS.
-- Replace with is_business_member() which is the correct helper.

DROP POLICY IF EXISTS "product_variants_read" ON public.product_variants;
CREATE POLICY "product_variants_read" ON public.product_variants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.is_business_member(p.business_id)
  )
);

DROP POLICY IF EXISTS "inventory_lots_read" ON public.inventory_lots;
CREATE POLICY "inventory_lots_read" ON public.inventory_lots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = inventory_lots.product_id
      AND public.is_business_member(p.business_id)
  )
);
