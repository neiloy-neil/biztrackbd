-- Insert the business-logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone to read logos (since it's public)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'business-logos');

-- Policy to allow authenticated users to upload logos
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Authenticated Uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'business-logos');

-- Policy to allow users to update their own uploads (optional, but good)
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'business-logos' AND 
  auth.role() = 'authenticated'
);

-- Add phone column to branches table
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone text;
