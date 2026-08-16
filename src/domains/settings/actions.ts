'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction, requirePermission } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

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
export const addStaff = requirePermission('staff.manage', authAction(async (data: { phone: string, role: string }, ctx) => {
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
export const updateStaffRole = requirePermission('staff.manage', authAction(async (data: { user_id: string, new_role: string }, ctx) => {
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
export const removeStaff = requirePermission('staff.manage', authAction(async (data: { user_id: string }, ctx) => {
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
