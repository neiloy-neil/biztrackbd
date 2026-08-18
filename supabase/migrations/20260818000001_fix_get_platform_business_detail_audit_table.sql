CREATE OR REPLACE FUNCTION public.get_platform_business_detail(p_business_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied. Platform Admin only.';
  END IF;

  SELECT json_build_object(
    'business', (SELECT row_to_json(b) FROM public.businesses b WHERE b.id = p_business_id),
    'owner', (
      SELECT json_build_object('id', au.id, 'email', au.email, 'phone', au.raw_user_meta_data->>'phone')
      FROM public.business_members bm
      JOIN auth.users au ON bm.user_id = au.id
      WHERE bm.business_id = p_business_id AND bm.role = 'owner'
      LIMIT 1
    ),
    'metrics', (
      SELECT json_build_object(
        'user_count', (SELECT count(*) FROM public.business_members WHERE business_id = p_business_id),
        'branch_count', (SELECT count(*) FROM public.branches WHERE business_id = p_business_id),
        'total_transactions', (SELECT count(*) FROM public.transactions WHERE business_id = p_business_id),
        'total_inventory', (SELECT count(*) FROM public.products WHERE business_id = p_business_id)
      )
    ),
    'subscription', (
      SELECT row_to_json(s)
      FROM (
        SELECT sub.*, p.name as plan_name, p.price_monthly, p.price_annual
        FROM public.subscriptions sub
        JOIN public.plans p ON sub.plan_id = p.id
        WHERE sub.business_id = p_business_id
        ORDER BY sub.created_at DESC LIMIT 1
      ) s
    ),
    'usage_this_month', (
      SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
      FROM public.usage_records u
      WHERE u.business_id = p_business_id AND u.period_start >= date_trunc('month', now())
    ),
    'recent_audits', (
      SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
      FROM (
        SELECT al.action, al.entity_type, al.created_at, au.email as user_email
        FROM public.business_audit_logs al
        LEFT JOIN auth.users au ON al.user_id = au.id
        WHERE al.business_id = p_business_id
        ORDER BY al.created_at DESC
        LIMIT 10
      ) a
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
