-- =============================================================
-- Migration: SECURITY DEFINER search_path Hardening (P0-B)
--
-- Without an explicit search_path, a SECURITY DEFINER function
-- inherits the caller's search_path at call time. A malicious
-- caller could shadow trusted functions/tables used inside the
-- function by setting their own search_path.
--
-- Fix: Pin search_path = public, pg_temp on every SECURITY
-- DEFINER function in the public schema.
--
-- This migration uses a dynamic DO block so it is resilient to
-- schema drift — it hardens whatever functions actually exist
-- rather than assuming the exact set from migration history.
--
-- Supabase reference:
-- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices
-- =============================================================

DO $$
DECLARE
  r          record;
  func_sig   text;
  n_hardened integer := 0;
  n_skipped  integer := 0;
BEGIN
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true          -- SECURITY DEFINER only
    ORDER BY p.proname
  LOOP
    func_sig := 'public.' || quote_ident(r.proname)
                || '(' || r.args || ')';
    BEGIN
      EXECUTE 'ALTER FUNCTION ' || func_sig
              || ' SET search_path = public, pg_temp';
      n_hardened := n_hardened + 1;
      RAISE NOTICE 'Hardened: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      n_skipped := n_skipped + 1;
      RAISE NOTICE 'Skipped: % — %', func_sig, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== search_path hardening complete: % hardened, % skipped ===',
    n_hardened, n_skipped;
END;
$$;
