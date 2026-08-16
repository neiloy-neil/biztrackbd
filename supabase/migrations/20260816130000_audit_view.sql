-- Audit View and RPCs
CREATE OR REPLACE FUNCTION public.get_transaction_audit(p_transaction_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- We use SECURITY DEFINER to bypass RLS and access auth.users
  SELECT jsonb_build_object(
    'created_by', COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = t.created_by), 'System'),
    'updated_by', (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = t.updated_by),
    'reversed_by', (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = t.reversed_by)
  ) INTO v_result
  FROM public.transactions t
  WHERE t.id = p_transaction_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
