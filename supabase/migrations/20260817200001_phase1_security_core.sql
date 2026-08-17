-- =============================================================
-- Migration: Phase 1 - Security Core Remediation
-- Fixes:
-- 1. Identity Forgery on INSERT (Enforce created_by = auth.uid() or sender_id = auth.uid())
-- 2. Storage Bucket Data Leak (Tenant isolation on support-attachments)
-- =============================================================

-- ============================================================
-- 1. Identity Forgery Protection
-- Ensure that any table with a created_by or user_id column
-- strictly enforces that the user cannot spoof another user's UUID.
-- ============================================================

-- Transactions
DROP POLICY IF EXISTS "Enforce created_by identity on transactions" ON public.transactions;
CREATE POLICY "Enforce created_by identity on transactions" ON public.transactions
  FOR INSERT WITH CHECK (created_by = auth.uid() OR created_by IS NULL);



-- support_tickets (user_id)
DROP POLICY IF EXISTS "Enforce user_id identity on support_tickets" ON public.support_tickets;
CREATE POLICY "Enforce user_id identity on support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- support_ticket_messages (sender_id)
DROP POLICY IF EXISTS "Enforce sender_id identity on support_ticket_messages" ON public.support_ticket_messages;
CREATE POLICY "Enforce sender_id identity on support_ticket_messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- platform_audit_logs (actor_id)
DROP POLICY IF EXISTS "Enforce actor_id identity on platform_audit_logs" ON public.platform_audit_logs;
CREATE POLICY "Enforce actor_id identity on platform_audit_logs" ON public.platform_audit_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);


-- ============================================================
-- 2. Storage Bucket Data Leak Fix
-- The 'support-attachments' bucket allowed any authenticated user
-- to read any object. We must restrict it to the business that owns it.
-- We use a function to extract the ticket ID from the storage path
-- and verify the user has access to that ticket.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_ticket_attachment(object_name text)
RETURNS boolean AS $$
DECLARE
  v_ticket_id uuid;
  v_business_id uuid;
BEGIN
  -- Assuming object_name format: 'ticket_id/filename.ext'
  v_ticket_id := (split_part(object_name, '/', 1))::uuid;
  
  -- If it's not a valid UUID format, fail closed
  IF v_ticket_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT business_id INTO v_business_id
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  IF v_business_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.is_business_member(v_business_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase requires using the API or raw SQL to update storage policies.
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
CREATE POLICY "Users can view attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'support-attachments' 
    AND auth.role() = 'authenticated'
    AND public.can_access_ticket_attachment(name)
  );

DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
CREATE POLICY "Users can upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-attachments' 
    AND auth.role() = 'authenticated'
    AND public.can_access_ticket_attachment(name)
  );

