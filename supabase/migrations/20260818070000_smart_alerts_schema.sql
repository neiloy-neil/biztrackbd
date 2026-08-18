-- Migration: Smart Alerts Schema
-- Creates the notifications table for proactively alerting shop owners

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'low_stock', 'overdue_due', 'expense_spike', 'system'
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid, -- Links to product_id, party_id, etc.
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_notifications_business_read ON public.notifications(business_id, is_read);
CREATE INDEX idx_notifications_business_type_ref ON public.notifications(business_id, type, reference_id);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their business notifications"
  ON public.notifications FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Users can update their business notifications"
  ON public.notifications FOR UPDATE
  USING (public.is_business_member(business_id));
