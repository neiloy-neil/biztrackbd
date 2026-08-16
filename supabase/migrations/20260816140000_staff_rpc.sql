-- 1. Function to add staff by phone number
CREATE OR REPLACE FUNCTION public.add_staff_by_phone(
  p_business_id uuid,
  p_phone text,
  p_role text
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_current_role text;
BEGIN
  -- Validate the role
  IF p_role NOT IN ('manager', 'cashier', 'staff') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role.');
  END IF;

  -- Ensure phone format starts with +880 (optional but recommended depending on how users sign up)
  -- For now, we will do an exact match on what auth.users has stored.
  
  -- Use SECURITY DEFINER context to query auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE phone = p_phone OR phone = REPLACE(p_phone, '+880', '880') OR phone = REPLACE(p_phone, '880', '+880');

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'এই ফোন নম্বরের কোনো ইউজার পাওয়া যায়নি। দয়া করে তাকে আগে অ্যাপে রেজিস্ট্রেশন করতে বলুন।');
  END IF;

  -- Check if they are already in the business
  SELECT role INTO v_current_role 
  FROM public.business_members 
  WHERE business_id = p_business_id AND user_id = v_user_id;

  IF v_current_role IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'এই ইউজারটি আগে থেকেই এই ব্যবসার সদস্য।');
  END IF;

  -- Insert the user into business_members
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (p_business_id, v_user_id, p_role::public.user_role);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to list staff with their full names and phone numbers
CREATE OR REPLACE FUNCTION public.get_staff_list(p_business_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  full_name text,
  phone text,
  joined_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bm.user_id, 
    bm.role::text, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'Unknown') as full_name,
    COALESCE(au.phone, 'Unknown') as phone,
    bm.created_at as joined_at
  FROM public.business_members bm
  JOIN auth.users au ON au.id = bm.user_id
  WHERE bm.business_id = p_business_id
  ORDER BY 
    CASE bm.role 
      WHEN 'owner' THEN 1 
      WHEN 'manager' THEN 2 
      WHEN 'cashier' THEN 3 
      WHEN 'staff' THEN 4 
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Function to update staff role (Cannot update 'owner' role to prevent losing access)
CREATE OR REPLACE FUNCTION public.update_staff_role(
  p_business_id uuid,
  p_user_id uuid,
  p_new_role text
)
RETURNS jsonb AS $$
DECLARE
  v_current_role text;
BEGIN
  -- Validate the role
  IF p_new_role NOT IN ('manager', 'cashier', 'staff') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role.');
  END IF;

  -- Check if they are in the business
  SELECT role INTO v_current_role 
  FROM public.business_members 
  WHERE business_id = p_business_id AND user_id = p_user_id;

  IF v_current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this business.');
  END IF;

  IF v_current_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change the role of the business owner.');
  END IF;

  -- Update the role
  UPDATE public.business_members 
  SET role = p_new_role::public.user_role
  WHERE business_id = p_business_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Function to remove a staff member (Cannot remove 'owner')
CREATE OR REPLACE FUNCTION public.remove_staff(
  p_business_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_current_role text;
BEGIN
  -- Check if they are in the business
  SELECT role INTO v_current_role 
  FROM public.business_members 
  WHERE business_id = p_business_id AND user_id = p_user_id;

  IF v_current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this business.');
  END IF;

  IF v_current_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the business owner.');
  END IF;

  -- Delete the member
  DELETE FROM public.business_members 
  WHERE business_id = p_business_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
