-- Add BD-specific account detail columns to support bank account numbers,
-- mobile wallet phone numbers, and bank names.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_number varchar(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS account_phone  varchar(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name      varchar(150) DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
