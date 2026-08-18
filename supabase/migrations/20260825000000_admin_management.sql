-- ==========================================
-- Admin Management RPCs
-- ==========================================

-- 1. Fetch Platform Admins
CREATE OR REPLACE FUNCTION public.get_platform_admins_list()
RETURNS TABLE (
    admin_id uuid,
    user_id uuid,
    email text,
    role_name text,
    created_at timestamptz
) AS $$
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.admins.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        pa.id AS admin_id,
        pa.user_id,
        au.email::text,
        pr.name AS role_name,
        pa.created_at
    FROM public.platform_admins pa
    JOIN public.platform_roles pr ON pa.role_id = pr.id
    JOIN auth.users au ON pa.user_id = au.id
    ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Assign Platform Admin Role
CREATE OR REPLACE FUNCTION public.assign_platform_admin_role(p_user_id uuid, p_role_name text)
RETURNS void AS $$
DECLARE
    v_role_id uuid;
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.admins.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get Role ID
    SELECT id INTO v_role_id FROM public.platform_roles WHERE name = p_role_name;
    
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Invalid role name';
    END IF;

    -- Upsert platform_admin
    INSERT INTO public.platform_admins (user_id, role_id)
    VALUES (p_user_id, v_role_id)
    ON CONFLICT (user_id) 
    DO UPDATE SET role_id = EXCLUDED.role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Remove Platform Admin
CREATE OR REPLACE FUNCTION public.remove_platform_admin(p_user_id uuid)
RETURNS void AS $$
BEGIN
    -- Authorization check
    IF NOT public.has_platform_permission('platform.admins.manage') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Prevent self-deletion
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot remove yourself';
    END IF;

    DELETE FROM public.platform_admins WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
