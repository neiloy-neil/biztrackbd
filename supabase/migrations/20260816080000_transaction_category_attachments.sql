-- Migration: Add category and attachments to transactions

ALTER TABLE public.transactions
ADD COLUMN category TEXT,
ADD COLUMN attachments TEXT[];
