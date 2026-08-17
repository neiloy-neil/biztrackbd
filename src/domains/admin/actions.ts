'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'

export async function getPlatformMetrics(_params: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_metrics_summary')
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function getPlatformGrowth(_params: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_growth_data')
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function fetchBusinessesList(searchQuery?: string, filterStatus?: string, filterPlan?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_businesses_list', {
    search_query: searchQuery || null,
    filter_status: filterStatus || null,
    filter_plan: filterPlan || null
  })

  if (error) {
    console.error('Error fetching businesses:', error)
    return []
  }
  return data || []
}

export async function fetchBusinessDetail(businessId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_business_detail', {
    p_business_id: businessId
  })

  if (error) {
    console.error('Error fetching business detail:', error)
    return null
  }
  return data
}

export async function suspendBusinessAction(businessId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_business', {
    p_business_id: businessId,
    p_reason: reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_business',
    target_type: 'business',
    target_id: businessId,
    new_state: { reason }
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${businessId}`)
  return { success: true }
}

export async function reactivateBusinessAction(businessId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reactivate_business', {
    p_business_id: businessId
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_business',
    target_type: 'business',
    target_id: businessId
  })
  
  revalidatePath('/admin/businesses')
  revalidatePath(`/admin/businesses/${businessId}`)
  return { success: true }
}

export async function deleteBusinessAction(businessId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('soft_delete_business', {
    p_business_id: businessId,
    p_reason: reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'delete_business',
    target_type: 'business',
    target_id: businessId,
    new_state: { reason }
  })
  
  revalidatePath('/admin/businesses')
  return { success: true }
}

export async function fetchUsersList(searchQuery?: string, filterStatus?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_users_list', {
    search_query: searchQuery || null,
    filter_status: filterStatus || null
  })

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }
  return data || []
}

import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function fetchUserDetail(userId: string) {
  const supabase = await createClient()
  
  // Verify platform admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) return null

  // Use service role to fetch auth users
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId)
  if (userError || !userData.user) {
    console.error('Error fetching user detail:', userError)
    return null
  }

  const u = userData.user
  const status = u.banned_until && new Date(u.banned_until) > new Date() ? 'suspended'
    : !u.last_sign_in_at ? 'unverified'
    : new Date(u.last_sign_in_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? 'inactive'
    : 'active'

  const { data: businesses } = await adminSupabase
    .from('business_members')
    .select('role, created_at, business_id, businesses(name, status)')
    .eq('user_id', userId)

  const { data: audits } = await adminSupabase
    .from('platform_audit_logs')
    .select('action, target_type, created_at')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
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
    sessions: [] // Sessions not easily fetchable via JS admin client, omitted for now
  }
}

export async function suspendUserAction(userId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_user', {
    p_user_id: userId,
    p_reason: reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'suspend_user',
    target_type: 'user',
    target_id: userId,
    new_state: { reason }
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function reactivateUserAction(userId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reactivate_user', {
    p_user_id: userId
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'reactivate_user',
    target_type: 'user',
    target_id: userId
  })
  
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function forceLogoutUserAction(userId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('force_logout_user', {
    p_user_id: userId,
    p_reason: reason
  })

  if (error) return { success: false, error: error.message }
  
  await logPlatformAction({
    action: 'force_logout_user',
    target_type: 'user',
    target_id: userId,
    new_state: { reason }
  })
  
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function getPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('plans').select('*').order('price_monthly', { ascending: true })
  if (error) {
    console.error('Error fetching plans:', error)
    return []
  }
  return data
}
