-- Migration: Remove auto-business creation trigger
-- We now enforce an explicit 6-step onboarding wizard for new users

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
