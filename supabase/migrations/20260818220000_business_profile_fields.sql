-- Extend businesses table with common business profile fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS district    text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS trade_license text,
  ADD COLUMN IF NOT EXISTS logo_url    text;
