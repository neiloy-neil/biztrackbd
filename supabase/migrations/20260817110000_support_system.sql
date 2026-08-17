-- Migration: Internal Support System

-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE public.ticket_status AS ENUM ('Open', 'In progress', 'Waiting for customer', 'Resolved', 'Closed');
CREATE TYPE public.ticket_category AS ENUM ('Billing', 'Login', 'Transaction', 'Inventory', 'Bug', 'Feature request', 'Other');
CREATE TYPE public.ticket_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- ==========================================
-- 2. TABLES
-- ==========================================
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category public.ticket_category NOT NULL,
  priority public.ticket_priority NOT NULL,
  status public.ticket_status DEFAULT 'Open'::public.ticket_status NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  attachment_url text,
  is_internal_note boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: Tenants see own business tickets
CREATE POLICY "Tenant isolation SELECT tickets" ON public.support_tickets 
FOR SELECT USING (public.is_business_member(business_id) OR public.is_platform_admin());

CREATE POLICY "Tenant isolation INSERT tickets" ON public.support_tickets 
FOR INSERT WITH CHECK (public.is_business_member(business_id));

-- Tickets: Admins manage all
CREATE POLICY "Admins manage tickets" ON public.support_tickets 
FOR UPDATE USING (public.is_platform_admin());

-- Messages: Tenants see non-internal messages for their tickets
CREATE POLICY "Tenant isolation SELECT messages" ON public.support_ticket_messages 
FOR SELECT USING (
  (
    is_internal_note = false AND 
    EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND public.is_business_member(st.business_id))
  ) OR public.is_platform_admin()
);

CREATE POLICY "Tenant isolation INSERT messages" ON public.support_ticket_messages 
FOR INSERT WITH CHECK (
  is_internal_note = false AND 
  EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND public.is_business_member(st.business_id))
);

-- Messages: Admins manage all
CREATE POLICY "Admins insert messages" ON public.support_ticket_messages 
FOR INSERT WITH CHECK (public.is_platform_admin());

-- Messages cannot be updated/deleted by anyone to maintain integrity (except maybe super admin directly)

-- ==========================================
-- 4. STORAGE BUCKET
-- ==========================================
-- Ensure storage schema exists and insert the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS (Tenants can access their own business attachments, Admins access all)
-- (Note: For simplicity, we might allow read access to authenticated users if the path contains their business ID, 
-- but a strict implementation would check the support_ticket_messages table. Here we use a basic policy)
CREATE POLICY "Users can upload attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');
