-- Daily Business Closing Migration

-- 1. Create daily_closings table
CREATE TABLE public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT NOT NULL,
  closing_date date NOT NULL,
  expected_cash numeric(19,4) NOT NULL,
  actual_cash numeric(19,4) NOT NULL,
  difference numeric(19,4) NOT NULL,
  reason text,
  summary jsonb NOT NULL,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, closing_date)
);

-- Enable RLS
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RBAC SELECT daily_closings" 
ON public.daily_closings FOR SELECT 
USING (public.has_permission(auth.uid(), business_id, 'reports.view'));

CREATE POLICY "RBAC INSERT daily_closings" 
ON public.daily_closings FOR INSERT 
WITH CHECK (public.has_permission(auth.uid(), business_id, 'closing.manage'));

-- 2. RPC to compute the daily summary securely
CREATE OR REPLACE FUNCTION public.get_daily_closing_summary(
  p_business_id uuid,
  p_date date
)
RETURNS jsonb AS $$
DECLARE
  v_expected_cash numeric(19,4) := 0;
  v_cash_sales numeric(19,4) := 0;
  v_cash_expenses numeric(19,4) := 0;
  v_cash_received numeric(19,4) := 0;
  v_cash_paid numeric(19,4) := 0;
  
  v_total_sales numeric(19,4) := 0;
  v_total_expenses numeric(19,4) := 0;
  v_total_profit numeric(19,4) := 0;

  v_bkash numeric(19,4) := 0;
  v_nagad numeric(19,4) := 0;
  v_bank numeric(19,4) := 0;
BEGIN
  -- 1. Calculate Expected Cash (sum of all cash account_transactions up to p_date)
  SELECT COALESCE(SUM(at.amount), 0) INTO v_expected_cash
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.transaction_date <= p_date;

  -- 2. Calculate Today's Cash Movements
  -- Sales
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_sales
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.type = 'sale'
    AND t.transaction_date = p_date;

  -- Expenses
  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_expenses
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.type = 'expense'
    AND t.transaction_date = p_date;

  -- Cash Received (payment_in)
  SELECT COALESCE(SUM(at.amount), 0) INTO v_cash_received
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.type = 'payment_in'
    AND t.transaction_date = p_date;

  -- Cash Paid (payment_out)
  SELECT COALESCE(SUM(ABS(at.amount)), 0) INTO v_cash_paid
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id 
    AND a.type = 'cash'
    AND t.type = 'payment_out'
    AND t.transaction_date = p_date;

  -- 3. Overall Daily Metrics
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'sale' AND transaction_date = p_date;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
  FROM public.transactions
  WHERE business_id = p_business_id AND type = 'expense' AND transaction_date = p_date;

  v_total_profit := v_total_sales - v_total_expenses;

  -- 4. Other Balances (bkash, nagad, bank) up to date
  SELECT COALESCE(SUM(at.amount), 0) INTO v_bkash
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.name ILIKE '%bkash%' AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_nagad
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.name ILIKE '%nagad%' AND t.transaction_date <= p_date;

  SELECT COALESCE(SUM(at.amount), 0) INTO v_bank
  FROM public.account_transactions at
  JOIN public.accounts a ON a.id = at.account_id
  JOIN public.transactions t ON t.id = at.transaction_id
  WHERE a.business_id = p_business_id AND a.type = 'bank' AND t.transaction_date <= p_date;

  RETURN jsonb_build_object(
    'expected_cash', v_expected_cash,
    'cash_sales', v_cash_sales,
    'cash_expenses', v_cash_expenses,
    'cash_received', v_cash_received,
    'cash_paid', v_cash_paid,
    'total_sales', v_total_sales,
    'total_expenses', v_total_expenses,
    'total_profit', v_total_profit,
    'balances', jsonb_build_object(
      'cash', v_expected_cash,
      'bkash', v_bkash,
      'nagad', v_nagad,
      'bank', v_bank
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
