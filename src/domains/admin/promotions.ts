'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logPlatformAction } from '@/lib/security/audit'
import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'

// Helper to get a service role client inside an admin action
// adminAction already verifies platform admin status securely
function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const getCoupons = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (_params: void, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { data, error } = await adminSupabase
    .from('coupons')
    .select('*, plans(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching coupons:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
})

export const createCoupon = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (params: { 
  code: string, 
  type: string, 
  value: number, 
  duration: string, 
  duration_in_months: number | null, 
  target_plan_id: string | null, 
  eligibility: string, 
  max_redemptions: number | null, 
  expires_at: string | null 
}, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { error } = await adminSupabase.from('coupons').insert({
    code: params.code.toUpperCase(),
    type: params.type,
    value: params.value,
    duration: params.duration,
    duration_in_months: params.duration_in_months,
    target_plan_id: params.target_plan_id,
    eligibility: params.eligibility,
    max_redemptions: params.max_redemptions,
    expires_at: params.expires_at
  })

  if (error) {
    console.error('Error creating coupon:', error)
    return { success: false, error: error.message }
  }

  await logPlatformAction({
    action: 'create_coupon',
    target_type: 'coupon',
    target_id: params.code.toUpperCase(),
    new_state: { type: params.type, value: params.value, duration: params.duration, target_plan_id: params.target_plan_id, eligibility: params.eligibility }
  })

  return { success: true, data: null }
})

export const toggleCouponActive = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (params: { couponId: string, isActive: boolean }, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { error } = await adminSupabase.from('coupons').update({ is_active: params.isActive }).eq('id', params.couponId)
  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: params.isActive ? 'enable_coupon' : 'disable_coupon',
    target_type: 'coupon',
    target_id: params.couponId
  })
  
  return { success: true, data: null }
})

export const extendTrial = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (params: { businessId: string, days: number }, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { data, error } = await adminSupabase.rpc('extend_trial', { p_business_id: params.businessId, p_days: params.days })
  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'extend_trial',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { days: params.days }
  })

  return { success: true, data }
})

export const grantPromotionalCredit = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (params: { businessId: string, amount: number, reason: string }, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { error } = await adminSupabase.from('promotional_credits').insert({
    business_id: params.businessId,
    amount: params.amount,
    reason: params.reason,
    created_by: ctx.userId
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'grant_promotional_credit',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { amount: params.amount, reason: params.reason }
  })
  
  return { success: true, data: null }
})
