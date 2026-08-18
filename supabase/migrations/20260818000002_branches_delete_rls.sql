-- Add missing DELETE policy on branches table.
-- SELECT/INSERT/UPDATE policies existed from the initial schema loop,
-- but DELETE was never included. Without this, deleteBranch silently deletes
-- 0 rows (RLS blocks it) but returns success:true to the caller.
-- Only owners and managers (settings.manage permission) can delete branches.
CREATE POLICY "Tenant isolation DELETE branches"
  ON public.branches
  FOR DELETE
  USING (public.has_permission(auth.uid(), business_id, 'settings.manage'));
