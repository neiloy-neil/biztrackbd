-- =============================================================
-- Migration: Secure Support Attachments
-- Hardens the RLS policies on the support-attachments bucket
-- =============================================================

-- 1. Drop existing overly permissive policies and any pre-existing new policies
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation INSERT support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation SELECT support attachments" ON storage.objects;

-- 2. Create strict INSERT policy
-- Users can only upload to a folder that matches their own business_id.
-- (storage.foldername(name))[1] gets the first folder in the path e.g. "business_id/user_id/file.png" -> "business_id"
CREATE POLICY "Tenant isolation INSERT support attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'support-attachments' 
  AND auth.role() = 'authenticated'
  AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

-- 3. Create strict SELECT policy
-- Platform admins can view any attachment.
-- Tenants can only view attachments where the root folder matches their business_id.
CREATE POLICY "Tenant isolation SELECT support attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'support-attachments' 
  AND auth.role() = 'authenticated'
  AND (
    public.is_platform_admin() 
    OR public.is_business_member((storage.foldername(name))[1]::uuid)
  )
);
