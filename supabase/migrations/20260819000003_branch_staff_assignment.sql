-- Add branch assignment to business_members so staff can be assigned to specific branches.
ALTER TABLE public.business_members
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL DEFAULT NULL;

-- Returns all staff for a business including their branch assignment.
CREATE OR REPLACE FUNCTION public.get_staff_with_branches(p_business_id uuid)
RETURNS TABLE(
  user_id   uuid,
  full_name text,
  phone     text,
  role      text,
  branch_id uuid
) AS $$
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    COALESCE(p.phone, '')            AS phone,
    m.role::text                     AS role,
    m.branch_id
  FROM public.business_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.business_id = p_business_id
  ORDER BY m.role, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
