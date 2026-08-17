-- FIN-08 fix: daily_closings has no "status" column.
-- A row existing means that date was closed. Remove the status check.
CREATE OR REPLACE FUNCTION public.prevent_transaction_on_closed_date()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.daily_closings
    WHERE business_id = NEW.business_id
      AND closing_date = NEW.transaction_date::date
  ) THEN
    RAISE EXCEPTION 'The business day % has already been closed. No new transactions can be recorded for this date.',
      NEW.transaction_date::date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
