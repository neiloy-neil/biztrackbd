import { describe, it, expect } from 'vitest'
import { 
  hasPermission, 
  canCreateSales, 
  canDeleteSales, 
  canCreateExpenses, 
  canManageStaff,
  PERMISSIONS
} from '../rbac'

describe('Role-Based Access Control (RBAC)', () => {
  it('Owner has full access to everything', () => {
    expect(hasPermission('owner', PERMISSIONS.SALES_CREATE)).toBe(true)
    expect(hasPermission('owner', PERMISSIONS.STAFF_MANAGE)).toBe(true)
    expect(hasPermission('owner', 'some.made.up.permission')).toBe(true)
  })

  it('Manager can manage daily operations and staff', () => {
    expect(canManageStaff('manager')).toBe(true)
    expect(canDeleteSales('manager')).toBe(true)
  })

  it('Cashier can create sales but cannot delete them', () => {
    expect(canCreateSales('cashier')).toBe(true)
    expect(canDeleteSales('cashier')).toBe(false)
  })

  it('Cashier cannot create expenses', () => {
    expect(canCreateExpenses('cashier')).toBe(false)
  })

  it('Unknown role has no permissions', () => {
    expect(canCreateSales('unknown')).toBe(false)
  })
})
