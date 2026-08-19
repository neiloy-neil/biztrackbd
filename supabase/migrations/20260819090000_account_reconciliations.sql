
-- Account Reconciliations Migration

CREATE TABLE public.account_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
  closing_id uuid REFERENCES public.daily_closings(id) ON DELETE CASCADE,
  reconciliation_date date NOT NULL,
  system_balance numeric(19,4) NOT NULL,
  actual_balance numeric(19,4) NOT NULL,
  difference numeric(19,4) NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, account_id, reconciliation_date)
);

ALTER TABLE public.account_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RBAC SELECT account_reconciliations" 
ON public.account_reconciliations FOR SELECT 
USING (public.has_permission(auth.uid(), business_id, 'reports.view'));

CREATE POLICY "RBAC INSERT account_reconciliations" 
ON public.account_reconciliations FOR INSERT 
WITH CHECK (public.has_permission(auth.uid(), business_id, 'closing.manage'));


-- RPC to fetch account balances for reconciliation up to a date
CREATE OR REPLACE FUNCTION public.get_account_balances_up_to_date(
  p_business_id uuid,
  p_date date
)
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_type text,
  system_balance numeric(19,4)
) AS $$$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    COALESCE(SUM(at.amount), 0) as system_balance
  FROM public.accounts a
  LEFT JOIN public.account_transactions at ON a.id = at.account_id
  LEFT JOIN public.transactions t ON t.id = at.transaction_id AND t.transaction_date <= p_date
  WHERE a.business_id = p_business_id
    AND a.deleted_at IS NULL
  GROUP BY a.id, a.name, a.type
  ORDER BY a.type, a.name;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

