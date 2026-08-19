-- Migration: Add SMS settings to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS sms_credits integer DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS enable_sms_alerts boolean DEFAULT true;
