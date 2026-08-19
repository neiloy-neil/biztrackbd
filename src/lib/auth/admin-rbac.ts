export const PLATFORM_PERMISSIONS = {
  DASHBOARD_VIEW: 'platform.dashboard.view',
  BUSINESSES_VIEW: 'platform.businesses.view',
  BUSINESSES_MANAGE: 'platform.businesses.manage',
  USERS_VIEW: 'platform.users.view',
  USERS_MANAGE: 'platform.users.manage',
  BILLING_VIEW: 'platform.billing.view',
  BILLING_MANAGE: 'platform.billing.manage',
  PLANS_VIEW: 'platform.plans.view',
  PLANS_MANAGE: 'platform.plans.manage',
  COUPONS_VIEW: 'platform.coupons.view',
  COUPONS_MANAGE: 'platform.coupons.manage',
  FEATURES_VIEW: 'platform.features.view',
  FEATURES_MANAGE: 'platform.features.manage',
  NOTIFICATIONS_VIEW: 'platform.notifications.view',
  NOTIFICATIONS_MANAGE: 'platform.notifications.manage',
  SUPPORT_VIEW: 'platform.support.view',
  SUPPORT_MANAGE: 'platform.support.manage',
  AUDIT_VIEW: 'platform.audit.view',
  SETTINGS_VIEW: 'platform.settings.view',
  SETTINGS_MANAGE: 'platform.settings.manage',
  ADMINS_VIEW: 'platform.admins.view',
  ADMINS_MANAGE: 'platform.admins.manage',
  SECURITY_MANAGE: 'platform.security.manage',
} as const;

export type PlatformPermission = typeof PLATFORM_PERMISSIONS[keyof typeof PLATFORM_PERMISSIONS];

export type PlatformRole = 'super_admin' | 'billing' | 'support';

const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: Object.values(PLATFORM_PERMISSIONS) as PlatformPermission[],
  billing: [
    PLATFORM_PERMISSIONS.DASHBOARD_VIEW,
    PLATFORM_PERMISSIONS.BUSINESSES_VIEW,
    PLATFORM_PERMISSIONS.USERS_VIEW,
    PLATFORM_PERMISSIONS.BILLING_VIEW,
    PLATFORM_PERMISSIONS.BILLING_MANAGE,
    PLATFORM_PERMISSIONS.PLANS_VIEW,
    PLATFORM_PERMISSIONS.PLANS_MANAGE,
    PLATFORM_PERMISSIONS.COUPONS_VIEW,
    PLATFORM_PERMISSIONS.COUPONS_MANAGE,
    PLATFORM_PERMISSIONS.SUPPORT_VIEW,
  ],
  support: [
    PLATFORM_PERMISSIONS.DASHBOARD_VIEW,
    PLATFORM_PERMISSIONS.BUSINESSES_VIEW,
    PLATFORM_PERMISSIONS.USERS_VIEW,
    PLATFORM_PERMISSIONS.BILLING_VIEW,
    PLATFORM_PERMISSIONS.SUPPORT_VIEW,
    PLATFORM_PERMISSIONS.SUPPORT_MANAGE,
  ],
};

export function hasPlatformPermission(role: string, permission: PlatformPermission): boolean {
  if (role === 'super_admin') return true;
  
  const perms = PLATFORM_ROLE_PERMISSIONS[role as PlatformRole] || [];
  return perms.includes(permission);
}
