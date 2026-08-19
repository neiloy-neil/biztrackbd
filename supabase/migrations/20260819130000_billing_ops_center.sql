-- Create platform_payment_operations table
CREATE TABLE IF NOT EXISTS public.platform_payment_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    provider text NOT NULL,
    transaction_id text,
    operation_type text NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL,
    failure_reason text,
    webhook_payload jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS for platform_payment_operations
ALTER TABLE public.platform_payment_operations ENABLE ROW LEVEL SECURITY;
