-- Fix product_variants and inventory_lots RLS policies that referenced
-- get_current_business_id() -- a function that was never defined.
-- Any query joining these tables (e.g. POS product fetch) received an
-- error, causing products to silently disappear from the POS.
-- Replace with is_business_member() which is the correct helper.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_variants') THEN
    DROP POLICY IF EXISTS "product_variants_read" ON public.product_variants;
    EXECUTE $policy$
      CREATE POLICY "product_variants_read" ON public.product_variants FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_variants.product_id
            AND public.is_business_member(p.business_id)
        )
      )
    $policy$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_lots') THEN
    DROP POLICY IF EXISTS "inventory_lots_read" ON public.inventory_lots;
    EXECUTE $policy$
      CREATE POLICY "inventory_lots_read" ON public.inventory_lots FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = inventory_lots.product_id
            AND public.is_business_member(p.business_id)
        )
      )
    $policy$;
  END IF;
END;
$$;
