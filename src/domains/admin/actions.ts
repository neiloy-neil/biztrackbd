'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'
import { adminAction } from '@/lib/actions/safe-action'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const getPlatformMetrics = adminAction(async (_params: void) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_metrics_summary')
  if (error) return { success: false, error: error.message }
  return { success: true, data }
})

export const getPlatformGrowth = adminAction(async (_params: void) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_growth_data')
  if (error) return { success: false, error: error.message }
  return { success: true, data }
})

export const fetchBusinessesList = adminAction(async (params: { searchQuery?: string, filterStatus?: string, filterPlan?: string }) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_businesses_list', {
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

export const fetchBusinessDetail = adminAction(async (params: { businessId: string }) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_business_detail', {
    p_business_id: params.businessId
  })

  if (error) {
    console.error('Error fetching business detail:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
})

export const suspendBusinessAction = adminAction(async (params: { businessId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_business',
    target_type: 'business',
    target_id: params.businessId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true }
})

export const reactivateBusinessAction = adminAction(async (params: { businessId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reactivate_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_business',
    target_type: 'business',
    target_id: params.businessId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true }
})

export const deleteBusinessAction = adminAction(async (params: { businessId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('soft_delete_business', {
    p_business_id: params.businessId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'delete_business',
    target_type: 'business',
    target_id: params.businessId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  return { success: true }
})

export const updateBusinessPlanAction = adminAction(async (params: { businessId: string, planId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_update_business_plan', {
    p_business_id: params.businessId,
    p_plan_id: params.planId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'update_business_plan',
    target_type: 'business',
    target_id: params.businessId,
    admin_id: ctx.userId,
    new_data: { plan_id: params.planId, reason: params.reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${params.businessId}`)
  return { success: true }
})

export const fetchPlatformUsersList = adminAction(async (params: { searchQuery?: string, filterStatus?: string }) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_users_list', {
    search_query: params.searchQuery || null,
    filter_status: params.filterStatus || null
  })

  if (error) {
    console.error('Error fetching users:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data: data || [] }
})

export const fetchPlatformUserDetail = adminAction(async (params: { userId: string }) => {
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

export const suspendUserAction = adminAction(async (params: { userId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_platform_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_user',
    target_type: 'user',
    target_id: params.userId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true }
})

export const reactivateUserAction = adminAction(async (params: { userId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reactivate_platform_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_user',
    target_type: 'user',
    target_id: params.userId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true }
})

export const forceLogoutUserAction = adminAction(async (params: { userId: string, reason: string }, ctx) => {
  const supabase = await createClient()
  const { error } = await supabase.rpc('force_logout_user', {
    p_user_id: params.userId,
    p_reason: params.reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'force_logout_user',
    target_type: 'user',
    target_id: params.userId,
    admin_id: ctx.userId,
    new_data: { reason: params.reason }
  })
  
  revalidatePath(`/admin/users/${params.userId}`)
  return { success: true }
})

export const getPlans = adminAction(async (_params: void) => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('plans').select('*').order('price_monthly', { ascending: true })
  if (error) {
    console.error('Error fetching plans:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
})
