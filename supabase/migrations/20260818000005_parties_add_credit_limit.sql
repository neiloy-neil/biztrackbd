-- credit_limit column was referenced in createParty action but missing from schema.
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS credit_limit numeric(19,4) NOT NULL DEFAULT 0;
