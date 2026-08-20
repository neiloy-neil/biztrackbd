'use server'

import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'
import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'
import { createPlatformNotification } from './notifications'

export const getPlatformMetrics = adminAction(PLATFORM_PERMISSIONS.DASHBOARD_VIEW, async (_params: void, ctx: any) => {
  // Use authClient so auth.uid() resolves inside the SECURITY DEFINER RPC
  const { data, error } = await ctx.authClient.rpc('get_platform_metrics_summary')
  if (error) return { success: false, error: error.message }

  await logSensitiveRead(ctx.authClient, 'system', 'all', 'viewed_platform_metrics')

  return { success: true, data }
})

export const getPlatformGrowth = adminAction(PLATFORM_PERMISSIONS.DASHBOARD_VIEW, async (_params: void, ctx: any) => {
  const { data, error } = await ctx.authClient.rpc('get_platform_growth_data')
  if (error) return { success: false, error: error.message }

  await logSensitiveRead(ctx.authClient, 'system', 'all', 'viewed_platform_growth')

  return { success: true, data }
})

export const fetchBusinessesList = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_VIEW, async (params: { searchQuery?: string, filterStatus?: string, filterPlan?: string }, ctx: any) => {
  const { data, error } = await ctx.authClient.rpc('get_platform_businesses_list', {
    search_query: params.searchQuery || null,
    filter_status: params.filterStatus || null,
    filter_plan: params.filterPlan || null
  })

  if (error) {
    console.error('Error fetching businesses:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data: data || [] }
})

import { logSensitiveRead } from '@/lib/supabase/admin'

export const fetchBusinessDetail = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_VIEW, async (params: { businessId: string }, ctx: any) => {
  const { data, error } = await ctx.authClient.rpc('get_platform_business_detail', {
    p_business_id: params.businessId
  })

  if (error) {
    console.error('Error fetching business detail:', error)
    return { success: false, error: error.message }
  }

  await logSensitiveRead(ctx.authClient, 'business', params.businessId, 'viewed_business_detail')

  return { success: true, data }
})

export const suspendBusinessAction = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_MANAGE, async (params: { businessId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('suspend_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_business',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true, data: null }
})

export const reactivateBusinessAction = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_MANAGE, async (params: { businessId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('reactivate_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_business',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true, data: null }
})

export const deleteBusinessAction = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_MANAGE, async (params: { businessId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('soft_delete_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'delete_business',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  return { success: true, data: null }
})

export const updateBusinessPlanAction = adminAction(PLATFORM_PERMISSIONS.BUSINESSES_MANAGE, async (params: { businessId: string, planId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('admin_update_business_plan', {
    p_business_id: params.businessId,
    p_plan_id: params.planId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'update_business_plan',
    target_type: 'business',
    target_id: params.businessId,
    new_state: { plan_id: params.planId, reason: params.reason }
  })

  // MF-09: Notify admins of plan change
  await createPlatformNotification(
    'plan_changed',
    'normal',
    'Plan Changed by Admin',
    `Plan for business ${params.businessId} was manually updated. Reason: ${params.reason}`,
    `/admin/businesses/${params.businessId}`,
    { business_id: params.businessId, plan_id: params.planId }
  )

  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true, data: null }
})

export const fetchPlatformUsersList = adminAction(PLATFORM_PERMISSIONS.USERS_VIEW, async (params: { searchQuery?: string, filterStatus?: string }, ctx: any) => {
  const { data, error } = await ctx.authClient.rpc('get_platform_users_list', {
    search_query: params.searchQuery || null,
    filter_status: params.filterStatus || null
  })

  if (error) {
    console.error('Error fetching users:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data: data || [] }
})

export const fetchPlatformUserDetail = adminAction(PLATFORM_PERMISSIONS.USERS_VIEW, async (params: { userId: string }, ctx: any) => {
  const adminSupabase = ctx.adminClient

  const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(params.userId)
  if (userError || !userData.user) {
    console.error('Error fetching user detail:', userError)
    return { success: false, error: userError?.message || 'User not found' }
  }

  const u = userData.user
  const status = u.banned_until && new Date(u.banned_until) > new Date() ? 'suspended'
    : !u.last_sign_in_at ? 'unverified'
    : new Date(u.last_sign_in_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? 'inactive'
    : 'active'

  const { data: businesses } = await adminSupabase
    .from('business_members')
    .select('role, created_at, business_id, businesses(name, status)')
    .eq('user_id', params.userId)

  const { data: audits } = await adminSupabase
    .from('platform_audit_logs')
    .select('action, target_type, created_at')
    .eq('target_id', params.userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    success: true,
    data: {
      user: {
        id: u.id,
        email: u.email,
        phone: u.user_metadata?.phone,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until,
        app_metadata: u.app_metadata,
        status
      },
      businesses: businesses?.map((b: any) => ({
        business_id: b.business_id,
        business_name: b.businesses?.name,
        role: b.role,
        joined_at: b.created_at,
        status: b.businesses?.status
      })) || [],
      recent_audits: audits || [],
      sessions: []
    }
  }
})

export const suspendUserAction = adminAction(PLATFORM_PERMISSIONS.USERS_MANAGE, async (params: { userId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('suspend_platform_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_user',
    target_type: 'user',
    target_id: params.userId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true, data: null }
})

export const reactivateUserAction = adminAction(PLATFORM_PERMISSIONS.USERS_MANAGE, async (params: { userId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('reactivate_platform_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_user',
    target_type: 'user',
    target_id: params.userId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true, data: null }
})

export const forceLogoutUserAction = adminAction(PLATFORM_PERMISSIONS.USERS_MANAGE, async (params: { userId: string, reason: string }, ctx: any) => {
  const { error } = await ctx.authClient.rpc('force_logout_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'force_logout_user',
    target_type: 'user',
    target_id: params.userId,
    new_state: { reason: params.reason }
  })
  
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true, data: null }
})

export const getPlans = adminAction(PLATFORM_PERMISSIONS.PLANS_MANAGE, async (_params: void, ctx: any) => {
  const supabase = ctx.adminClient
  const { data, error } = await supabase.from('plans').select('*, plan_features(*)').order('price_monthly', { ascending: true })
  if (error) {
    console.error('Error fetching plans:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
})

export const updatePlanAction = adminAction(PLATFORM_PERMISSIONS.PLANS_MANAGE, async (params: {
  planId: string
  name?: string
  description?: string
  priceMonthly?: number
  isActive?: boolean
}, ctx: any) => {
  const { error } = await ctx.authClient.rpc('update_plan_pricing', {
    p_plan_id: params.planId,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_price_monthly: params.priceMonthly ?? null,
    p_is_active: params.isActive ?? null,
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'update_plan',
    target_type: 'plan',
    target_id: params.planId,
    new_state: params
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const updatePlanFeatureAction = adminAction(PLATFORM_PERMISSIONS.PLANS_MANAGE, async (params: {
  planId: string
  featureKey: string
  limitValue: number | null
  hardLimit?: number | null
}, ctx: any) => {
  const { error } = await ctx.authClient.rpc('upsert_plan_feature', {
    p_plan_id: params.planId,
    p_feature_key: params.featureKey,
    p_limit_value: params.limitValue,
    p_hard_limit: params.hardLimit ?? null,
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'update_plan_feature',
    target_type: 'plan',
    target_id: params.planId,
    new_state: params
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const testSmsGateway = adminAction(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (params: { phone: string }, ctx: any) => {
  const apiKey = process.env.SMS_NET_BD_API_KEY
  if (!apiKey) return { success: false, error: 'SMS_NET_BD_API_KEY is not configured.' }

  const digits = params.phone.replace(/\D/g, '')
  const normalized = digits.startsWith('880') ? digits : digits.startsWith('0') ? `880${digits.slice(1)}` : `880${digits}`

  const msg = `[BizTrack BD] SMS gateway test successful. If you received this, the integration is working.`
  const body = new URLSearchParams({ api_key: apiKey, msg, to: normalized })

  try {
    const res = await fetch('https://api.sms.net.bd/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json()
    if (data.error !== 0) return { success: false, error: `SMS gateway error: ${data.msg}` }
    return { success: true, data: { to: normalized, response: data } }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})
