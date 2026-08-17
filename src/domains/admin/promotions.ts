'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logPlatformAction } from '@/lib/security/audit'

export async function getCoupons() {
  const supabase = await createClient()
  
  // Verify platform admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) return []

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminSupabase
    .from('coupons')
    .select('*, plans(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching coupons:', error)
    return []
  }
  return data
}

export async function createCoupon(formData: FormData) {
  const supabase = await createClient()
  
  // Verify platform admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) throw new Error('Unauthorized')

  const code = formData.get('code') as string
  const type = formData.get('type') as string
  const value = parseFloat(formData.get('value') as string)
  const duration = formData.get('duration') as string
  const duration_in_months = duration === 'repeating' ? parseInt(formData.get('duration_in_months') as string) : null
  const target_plan_id = formData.get('target_plan_id') as string || null
  const eligibility = formData.get('eligibility') as string
  const max_redemptions = formData.get('max_redemptions') ? parseInt(formData.get('max_redemptions') as string) : null
  const expires_at = formData.get('expires_at') as string || null

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminSupabase.from('coupons').insert({
    code: code.toUpperCase(),
    type,
    value,
    duration,
    duration_in_months,
    target_plan_id,
    eligibility,
    max_redemptions,
    expires_at
  })

  if (error) {
    console.error('Error creating coupon:', error)
    throw new Error(error.message)
  }

  await logPlatformAction({
    action: 'create_coupon',
    target_type: 'coupon',
    target_id: code.toUpperCase(),
    new_state: { type, value, duration, target_plan_id, eligibility }
  })
}

export async function toggleCouponActive(couponId: string, isActive: boolean) {
  const supabase = await createClient()
  
  // Verify platform admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminSupabase.from('coupons').update({ is_active: isActive }).eq('id', couponId)
  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: isActive ? 'enable_coupon' : 'disable_coupon',
    target_type: 'coupon',
    target_id: couponId
  })
}

export async function extendTrial(businessId: string, days: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminSupabase.rpc('extend_trial', { p_business_id: businessId, p_days: days })
  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'extend_trial',
    target_type: 'business',
    target_id: businessId,
    new_state: { days }
  })

  return data
}

export async function grantPromotionalCredit(businessId: string, amount: number, reason: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminSupabase.from('promotional_credits').insert({
    business_id: businessId,
    amount,
    reason,
    created_by: user.id
  })

  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'grant_promotional_credit',
    target_type: 'business',
    target_id: businessId,
    new_state: { amount, reason }
  })
}
