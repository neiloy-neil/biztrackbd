-- ==========================================
-- 1. ADMIN RBAC SCHEMA
-- ==========================================

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.platform_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.platform_role_permissions (
  role_id uuid REFERENCES public.platform_roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.platform_permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

-- Update platform_admins
ALTER TABLE public.platform_admins ADD COLUMN role_id uuid REFERENCES public.platform_roles(id);

-- Enable RLS
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_role_permissions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. AUTHORIZATION CHECK FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_platform_permission(required_permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.platform_admins pa
    JOIN public.platform_role_permissions prp ON pa.role_id = prp.role_id
    JOIN public.platform_permissions pp ON prp.permission_id = pp.id
    WHERE pa.user_id = auth.uid() 
    AND pp.name = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Override RLS to allow Admins with permission to manage RBAC
CREATE POLICY "Super admins view roles" ON public.platform_roles FOR SELECT USING (public.has_platform_permission('platform.admins.manage'));
CREATE POLICY "Super admins view permissions" ON public.platform_permissions FOR SELECT USING (public.has_platform_permission('platform.admins.manage'));
CREATE POLICY "Super admins view role_perms" ON public.platform_role_permissions FOR SELECT USING (public.has_platform_permission('platform.admins.manage'));

-- ==========================================
-- 3. SEED INITIAL ROLES & PERMISSIONS
-- ==========================================

DO $$
DECLARE
  super_admin_id uuid;
  billing_id uuid;
  support_id uuid;
BEGIN
  -- Insert Roles
  INSERT INTO public.platform_roles (name) VALUES ('super_admin') RETURNING id INTO super_admin_id;
  INSERT INTO public.platform_roles (name) VALUES ('billing') RETURNING id INTO billing_id;
  INSERT INTO public.platform_roles (name) VALUES ('support') RETURNING id INTO support_id;

  -- Insert Permissions
  INSERT INTO public.platform_permissions (name) VALUES 
    ('platform.dashboard.view'),
    ('platform.users.view'),
    ('platform.users.manage'),
    ('platform.businesses.view'),
    ('platform.businesses.manage'),
    ('platform.billing.view'),
    ('platform.billing.manage'),
    ('platform.plans.manage'),
    ('platform.coupons.manage'),
    ('platform.features.manage'),
    ('platform.notifications.manage'),
    ('platform.support.manage'),
    ('platform.audit.view'),
    ('platform.security.manage'),
    ('platform.settings.manage'),
    ('platform.admins.manage');

  -- Assign All to Super Admin
  INSERT INTO public.platform_role_permissions (role_id, permission_id)
  SELECT super_admin_id, id FROM public.platform_permissions;

  -- Assign to Billing
  INSERT INTO public.platform_role_permissions (role_id, permission_id)
  SELECT billing_id, id FROM public.platform_permissions 
  WHERE name IN (
    'platform.dashboard.view',
    'platform.users.view',
    'platform.businesses.view',
    'platform.billing.view',
    'platform.billing.manage',
    'platform.plans.manage',
    'platform.coupons.manage'
  );

  -- Assign to Support
  INSERT INTO public.platform_role_permissions (role_id, permission_id)
  SELECT support_id, id FROM public.platform_permissions 
  WHERE name IN (
    'platform.dashboard.view',
    'platform.users.view',
    'platform.businesses.view',
    'platform.support.manage'
  );

  -- Ensure existing platform admins are super_admins temporarily so they don't get locked out
  UPDATE public.platform_admins SET role_id = super_admin_id WHERE role_id IS NULL;
END $$;
