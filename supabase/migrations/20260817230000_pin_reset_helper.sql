-- Helper: look up auth user ID by derived email (needed for PIN reset).
-- Only callable server-side via service-role key; no direct user access.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
