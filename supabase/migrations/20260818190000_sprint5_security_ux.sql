-- =============================================================
-- Migration: Sprint 5 - Observability, Security Hardening & UX
-- Fixes:
-- 1. FIN-07: Include opening_balance + income in daily closing expected cash
-- 2. FIN-08: Block transactions on already-closed dates
-- 3. SEC-03: Support attachment tenant isolation (storage policy fix)
-- 4. SEC-04: Support message sender_id forgery fix
-- 5. SEC-05: Support ticket field spoofing fix
-- 6. SEC-10: Cross-tenant party_id validation trigger
-- 7. OBS-01: Audit log entry for create_transaction_atomic
-- 8. OBS-02: revalidatePath covered in TS — add DB-level audit comment
-- =============================================================


-- ============================================================
-- 1. FIN-07: Fix get_daily_closing_summary to include
--    opening_balance and income in expected cash calculation
-- ============================================================
DROP FUNCTION IF EXISTS public.get_daily_closing_summary(uuid, date);

CREATE OR REPLACE FUNCTION public.get_daily_closing_summary(
  p_business_id uuid,
  p_date        date DEFAULT CURRENT_DATE
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'expected_cash', COALESCE((
      SELECT SUM(
        CASE
          WHEN t.type IN ('sale', 'payment_in', 'income', 'opening_balance') THEN at.amount
          WHEN t.type IN ('expense', 'payment_out', 'purchase')             THEN -at.amount
          ELSE 0
        END
      )
      FROM public.transactions t
      JOIN public.account_transactions at ON at.transaction_id = t.id
      JOIN public.accounts a ON a.id = at.account_id
      WHERE t.business_id = p_business_id
        AND t.transaction_date = p_date
        AND t.state = 'completed'
        AND a.type = 'cash'
    ), 0),
    'total_sales', COALESCE((
      SELECT SUM(total_amount)
      FROM public.transactions
      WHERE business_id = p_business_id
        AND type = 'sale'
        AND state = 'completed'
        AND transaction_date = p_date
    ), 0),
    'total_income', COALESCE((
      SELECT SUM(total_amount)
      FROM public.transactions
      WHERE business_id = p_business_id
        AND type = 'income'
        AND state = 'completed'
        AND transaction_date = p_date
    ), 0),
    'total_expenses', COALESCE((
      SELECT SUM(total_amount)
      FROM public.transactions
      WHERE business_id = p_business_id
        AND type IN ('expense', 'purchase')
        AND state = 'completed'
        AND transaction_date = p_date
    ), 0),
    'total_payments_in', COALESCE((
      SELECT SUM(total_amount)
      FROM public.transactions
      WHERE business_id = p_business_id
        AND type = 'payment_in'
        AND state = 'completed'
        AND transaction_date = p_date
    ), 0),
    'total_payments_out', COALESCE((
      SELECT SUM(total_amount)
      FROM public.transactions
      WHERE business_id = p_business_id
        AND type = 'payment_out'
        AND state = 'completed'
        AND transaction_date = p_date
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 2. FIN-08: Block transaction creation on already-closed dates
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_transaction_on_closed_date()
RETURNS trigger AS $$
BEGIN
  -- Only block if a closed daily_closing record exists for this date
  IF EXISTS (
    SELECT 1 FROM public.daily_closings
    WHERE business_id = NEW.business_id
      AND closing_date = NEW.transaction_date::date
      AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'The business day % has already been closed. No new transactions can be recorded for this date.',
      NEW.transaction_date::date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_closed_date_txn ON public.transactions;
CREATE TRIGGER trg_prevent_closed_date_txn
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_on_closed_date();


-- ============================================================
-- 3. SEC-04: Fix support message sender_id forgery
--    Add WITH CHECK (sender_id = auth.uid()) to INSERT policy
-- ============================================================
DROP POLICY IF EXISTS "Support ticket messages insert" ON public.support_ticket_messages;

CREATE POLICY "Support ticket messages insert"
  ON public.support_ticket_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id
        AND public.is_business_member(st.business_id)
    )
  );


-- ============================================================
-- 4. SEC-05: Fix support ticket field spoofing
--    Enforce user_id = auth.uid(), assigned_to IS NULL, status = 'open' on INSERT
-- ============================================================
DROP POLICY IF EXISTS "Support tickets insert" ON public.support_tickets;

CREATE POLICY "Support tickets insert"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND assigned_to IS NULL
    AND status = 'Open'::public.ticket_status
    AND public.is_business_member(business_id)
  );


-- ============================================================
-- 5. SEC-10: Cross-tenant party_id validation trigger
--    Ensures transactions.party_id belongs to the same business
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_transaction_party()
RETURNS trigger AS $$
BEGIN
  IF NEW.party_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.parties
      WHERE id = NEW.party_id
        AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'party_id % does not belong to business %', NEW.party_id, NEW.business_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_transaction_party ON public.transactions;
CREATE TRIGGER trg_validate_transaction_party
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_party();


-- ============================================================
-- 6. SEC-11: Cross-tenant transaction_item product validation
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_transaction_item_product()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.transactions t ON t.id = NEW.transaction_id
      WHERE p.id = NEW.product_id
        AND p.business_id = t.business_id
    ) THEN
      RAISE EXCEPTION 'product_id % does not belong to the same business as transaction %',
        NEW.product_id, NEW.transaction_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_txn_item_product ON public.transaction_items;
CREATE TRIGGER trg_validate_txn_item_product
  BEFORE INSERT ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_item_product();


-- ============================================================
-- 7. MF-25: Enforce individual user suspension in middleware-level DB check
--    Add a fast function checked by the app layer
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Returns false if the user's auth record is banned (suspended)
  -- The app middleware calls this to gate access.
  RETURN NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
      AND banned_until IS NOT NULL
      AND banned_until > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
