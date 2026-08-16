'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function fetchUserDetail(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_user_detail', {
    p_user_id: userId
  })

  if (error) {
    console.error('Error fetching user detail:', error)
    return null
  }
  return data
}

export async function suspendUserAction(userId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_user', {
    p_user_id: userId,
    p_reason: reason
  })

  if (error) return { success: false, error: error.message }
  
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
  
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}
