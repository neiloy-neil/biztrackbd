-- Custom Phone OTP table (bypasses Supabase phone auth entirely)
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps(phone, verified_at);

-- No RLS needed - this table is only accessed via SECURITY DEFINER functions
-- Add a cleanup: OTPs older than 1 hour are irrelevant
