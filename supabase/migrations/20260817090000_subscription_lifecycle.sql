-- Migration: Subscription Lifecycle Management

-- Add scheduled downgrade plan ID
ALTER TABLE public.subscriptions 
ADD COLUMN scheduled_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

-- Add cancellation timestamp to track when user requested cancellation
ALTER TABLE public.subscriptions 
ADD COLUMN canceled_at timestamptz;

-- Add subscription_status value for 'suspended' if it doesn't exist
-- (Assuming ENUM public.subscription_status already exists. PostgreSQL requires an ALTER TYPE ADD VALUE)
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'suspended';
