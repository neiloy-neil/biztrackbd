-- Migration: Security Infrastructure (Idempotency and Storage)

-- 1. Idempotency Keys Table
CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_path text NOT NULL,
  request_params jsonb,
  response_code integer,
  response_body jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS for Idempotency Keys (Internal use mostly, but good to secure)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own idempotency keys" ON public.idempotency_keys 
  FOR ALL USING (user_id = auth.uid() AND public.is_business_member(business_id));

-- 2. Storage Bucket Creation (Business Attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business_attachments', 
  'business_attachments', 
  false, 
  5242880, -- 5MB limit
  '{"image/jpeg", "image/png", "application/pdf"}'
) ON CONFLICT (id) DO UPDATE 
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage Policies for Business Attachments
-- We ensure that users can only upload and read files where the folder name matches their business_id
-- Path format: business_id/filename.ext

CREATE POLICY "Users can upload to their business folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'business_attachments' AND 
    auth.uid() = owner AND
    (SELECT public.is_business_member((storage.foldername(name))[1]::uuid))
  );

CREATE POLICY "Users can read from their business folder" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'business_attachments' AND 
    (SELECT public.is_business_member((storage.foldername(name))[1]::uuid))
  );

CREATE POLICY "Users can delete from their business folder" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'business_attachments' AND 
    (SELECT public.is_business_member((storage.foldername(name))[1]::uuid))
  );
