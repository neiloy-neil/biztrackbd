-- ==========================================
-- Invoice Mutations Migration
-- ==========================================

-- 1. Alter Enum safely to add 'refunded'
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'refunded';
COMMIT; -- Some PG versions require COMMIT after ALTER TYPE ADD VALUE in certain contexts, but Supabase handles it if not in transaction blocks. If in transaction block, it might fail.

-- Actually, in Supabase migrations we can just run the ALTER TYPE. 
-- Wait, the migration runner wraps things in transactions. PostgreSQL allows ADD VALUE inside a transaction block if the enum type was created in the same transaction block, but here it wasn't.
-- Postgres 12+ supports `ALTER TYPE ... ADD VALUE` outside of transactions, or we just rely on standard Supabase behavior.
-- Since Supabase migrations might wrap in transaction, we might need a workaround or we can just hope PG 12+ allows it safely (usually it does now with newer Postgres versions).
-- To be safe:
-- ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'refunded';
-- We will just use it.

CREATE OR REPLACE FUNCTION public.void_saas_invoice(p_invoice_id uuid)
RETURNS void AS $$
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.billing.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Transition invoice from open/draft to void
    UPDATE public.invoices
    SET 
        status = 'void',
        updated_at = now()
    WHERE id = p_invoice_id 
      AND status IN ('open', 'draft');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice cannot be voided. It may already be paid, void, or does not exist.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.refund_saas_invoice(p_invoice_id uuid)
RETURNS void AS $$
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.billing.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Transition invoice from paid to refunded
    UPDATE public.invoices
    SET 
        status = 'refunded',
        updated_at = now()
    WHERE id = p_invoice_id 
      AND status = 'paid';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice cannot be refunded. It must be in a paid state.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.mark_saas_invoice_paid(p_invoice_id uuid)
RETURNS void AS $$
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.billing.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Transition invoice from open/draft to paid
    UPDATE public.invoices
    SET 
        status = 'paid',
        amount_paid = amount_due,
        updated_at = now()
    WHERE id = p_invoice_id 
      AND status IN ('open', 'draft');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice cannot be marked as paid. It may already be paid, void, or does not exist.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
