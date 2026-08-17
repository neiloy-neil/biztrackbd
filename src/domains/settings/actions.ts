'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction, requirePermission } from '@/lib/actions/safe-action'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

import { canUseFeature } from '@/domains/saas/entitlements'

// ── Business ──────────────────────────────────────────────────────────────────

export const getBusinessProfile = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  const { data: biz, error } = await supabase
    .from('businesses')
    .select('id, name, phone, address, district, business_type, trade_license, logo_url, currency, timezone')
    .eq('id', ctx.businessId)
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: biz }
})

export const updateBusinessProfile = authAction(async (
  data: {
    name: string
    phone?: string
    address?: string
    district?: string
    business_type?: string
    trade_license?: string
    logo_url?: string
  },
  ctx
) => {
  const supabase = await createClient()
  const { error } = await supabase
    .from('businesses')
    .update({
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      district: data.district?.trim() || null,
      business_type: data.business_type?.trim() || null,
      trade_license: data.trade_license?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.businessId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/app/settings')
  revalidatePath('/app/settings/business')
  return { success: true }
})

// ── Accounts ──────────────────────────────────────────────────────────────────

export const getAccountsWithBalance = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, type, current_balance')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('type')
    .order('name')
  if (error) return { success: false, error: error.message }
  return { success: true, data: accounts }
})

export const createAccount = authAction(async (
  data: { name: string; type: string },
  ctx
) => {
  const supabase = await createClient()
  const { error } = await supabase.from('accounts').insert({
    business_id: ctx.businessId,
    name: data.name.trim(),
    type: data.type,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
})

export const updateAccount = authAction(async (
  data: { id: string; name: string },
  ctx
) => {
  const supabase = await createClient()
  const { error } = await supabase
    .from('accounts')
    .update({ name: data.name.trim(), updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('business_id', ctx.businessId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
})

export const deleteAccount = authAction(async (
  data: { id: string },
  ctx
) => {
  const supabase = await createClient()
  // Only allow deletion if current_balance is zero (soft-delete)
  const { data: acc, error: fetchErr } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', data.id)
    .eq('business_id', ctx.businessId)
    .single()
  if (fetchErr || !acc) return { success: false, error: 'Account not found.' }
  if (Number(acc.current_balance) !== 0)
    return { success: false, error: 'ব্যালেন্স শূন্য না হলে মুছে ফেলা যাবে না।' }
  const { error } = await supabase
    .from('accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('business_id', ctx.businessId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
})

// 1. Get Staff List
export const getStaffList = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  const { data: staffList, error } = await supabase.rpc('get_staff_list', { p_business_id: ctx.businessId })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, data: staffList }
})

// 2. Add Staff (Requires 'staff.manage' permission)
export const addStaff = requirePermission(PERMISSIONS.STAFF_MANAGE, authAction(async (data: { phone: string, role: string }, ctx) => {
  const canAddStaff = await canUseFeature(ctx.businessId, 'max_users')
  if (!canAddStaff) {
    return { success: false, error: 'Maximum staff limit reached for your plan' }
  }

  const supabase = await createClient()

  const cleanPhone = data.phone.trim()
  if (!cleanPhone) {
    return { success: false, error: 'Phone number is required.' }
  }

  const { data: result, error } = await supabase.rpc('add_staff_by_phone', { 
    p_business_id: ctx.businessId,
    p_phone: cleanPhone,
    p_role: data.role
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/settings/staff')
  return { success: true, data: result }
}))

// 3. Update Staff Role (Requires 'staff.manage' permission)
export const updateStaffRole = requirePermission(PERMISSIONS.STAFF_MANAGE, authAction(async (data: { user_id: string, new_role: string }, ctx) => {
  const supabase = await createClient()

  const { data: result, error } = await supabase.rpc('update_staff_role', { 
    p_business_id: ctx.businessId,
    p_user_id: data.user_id,
    p_new_role: data.new_role
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/settings/staff')
  return { success: true, data: result }
}))

// 4. Remove Staff (Requires 'staff.manage' permission)
export const removeStaff = requirePermission(PERMISSIONS.STAFF_MANAGE, authAction(async (data: { user_id: string }, ctx) => {
  const supabase = await createClient()

  const { data: result, error } = await supabase.rpc('remove_staff', { 
    p_business_id: ctx.businessId,
    p_user_id: data.user_id
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/settings/staff')
  return { success: true, data: result }
}))
