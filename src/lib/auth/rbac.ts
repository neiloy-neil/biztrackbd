export const PERMISSIONS = {
  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  SALES_EDIT: 'sales.edit',
  SALES_DELETE: 'sales.delete',

  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_EDIT: 'expenses.edit',
  EXPENSES_DELETE: 'expenses.delete',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',

  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',

  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',

  INVENTORY_MANAGE: 'inventory.manage',
  REPORTS_VIEW: 'reports.view',
  
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',
  
  SETTINGS_MANAGE: 'settings.manage',
  CLOSING_MANAGE: 'closing.manage',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Mirror of public.has_permission() in the DB (migrations/20260817190000_rbac_canonical.sql).
// These two must stay in sync — the DB function is the canonical source.
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ['*' as any],
  manager: [
    PERMISSIONS.SALES_CREATE,    PERMISSIONS.SALES_VIEW,      PERMISSIONS.SALES_EDIT, PERMISSIONS.SALES_DELETE,
    PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_VIEW,   PERMISSIONS.EXPENSES_EDIT, PERMISSIONS.EXPENSES_DELETE,
    PERMISSIONS.CUSTOMERS_VIEW,  PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.SUPPLIERS_VIEW,  PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,   PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.STAFF_VIEW,      PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.CLOSING_MANAGE,
  ],
  cashier: [
    PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CLOSING_MANAGE,
  ],
  staff: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
  ],
}

export function hasPermission(role: string, permission: string): boolean {
  if (role === 'owner') return true
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes(permission as any) || perms.includes('*' as any)
}

// Semantic Helpers for cleaner codebase readability
export const canCreateSales = (role: string) => hasPermission(role, PERMISSIONS.SALES_CREATE)
export const canViewSales = (role: string) => hasPermission(role, PERMISSIONS.SALES_VIEW)
export const canDeleteSales = (role: string) => hasPermission(role, PERMISSIONS.SALES_DELETE)

export const canCreateExpenses = (role: string) => hasPermission(role, PERMISSIONS.EXPENSES_CREATE)
export const canDeleteExpenses = (role: string) => hasPermission(role, PERMISSIONS.EXPENSES_DELETE)

export const canManageCustomers = (role: string) => hasPermission(role, PERMISSIONS.CUSTOMERS_MANAGE)
export const canManageSuppliers = (role: string) => hasPermission(role, PERMISSIONS.SUPPLIERS_MANAGE)
export const canManageProducts = (role: string) => hasPermission(role, PERMISSIONS.PRODUCTS_MANAGE)
export const canManageInventory = (role: string) => hasPermission(role, PERMISSIONS.INVENTORY_MANAGE)

export const canManageStaff = (role: string) => hasPermission(role, PERMISSIONS.STAFF_MANAGE)
export const canManageSettings = (role: string) => hasPermission(role, PERMISSIONS.SETTINGS_MANAGE)
export const canManageClosing = (role: string) => hasPermission(role, PERMISSIONS.CLOSING_MANAGE)
