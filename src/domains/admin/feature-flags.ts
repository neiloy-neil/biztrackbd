'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logPlatformAction } from '@/lib/security/audit'
import { revalidatePath } from 'next/cache'
import { adminAction } from '@/lib/actions/safe-action'

// Helper to get a service role client inside an admin action
// adminAction already verifies platform admin status securely
function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const createFeatureFlag = adminAction(async (params: { id: string, description: string, isGlobalEnabled: boolean }, ctx) => {
  const adminSupabase = getAdminSupabase()

  const { error } = await adminSupabase.from('feature_flags').insert({
    id: params.id,
    description: params.description,
    is_global_enabled: params.isGlobalEnabled
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'create_feature_flag',
    target_type: 'feature_flag',
    target_id: params.id,
    new_state: { description: params.description, is_global_enabled: params.isGlobalEnabled }
  })

  revalidatePath('/admin/feature-flags')
  return { success: true, data: null }
})

export const toggleGlobalFeatureFlag = adminAction(async (params: { id: string, isGlobalEnabled: boolean }, ctx) => {
  const adminSupabase = getAdminSupabase()

  const { error } = await adminSupabase.from('feature_flags')
    .update({ is_global_enabled: params.isGlobalEnabled, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'toggle_global_feature_flag',
    target_type: 'feature_flag',
    target_id: params.id,
    new_state: { is_global_enabled: params.isGlobalEnabled }
  })

  revalidatePath('/admin/feature-flags')
  revalidatePath(`/admin/feature-flags/${params.id}`)
  return { success: true, data: null }
})

export const setFlagPlanEntitlement = adminAction(async (params: { flagId: string, planId: string, enabled: boolean }, ctx) => {
  const adminSupabase = getAdminSupabase()

  if (params.enabled) {
    const { error } = await adminSupabase.from('feature_flag_plans').insert({ flag_id: params.flagId, plan_id: params.planId })
    if (error && error.code !== '23505') return { success: false, error: error.message } // Ignore duplicate
  } else {
    const { error } = await adminSupabase.from('feature_flag_plans').delete().match({ flag_id: params.flagId, plan_id: params.planId })
    if (error) return { success: false, error: error.message }
  }

  await logPlatformAction({
    action: 'update_flag_plan_entitlement',
    target_type: 'feature_flag',
    target_id: params.flagId,
    new_state: { plan_id: params.planId, enabled: params.enabled }
  })

  revalidatePath(`/admin/feature-flags/${params.flagId}`)
  return { success: true, data: null }
})

export const addFlagOverride = adminAction(async (params: { flagId: string, targetType: 'business' | 'user', targetId: string, isEnabled: boolean }, ctx) => {
  const adminSupabase = getAdminSupabase()

  const { error } = await adminSupabase.from('feature_flag_overrides').upsert({
    flag_id: params.flagId,
    target_type: params.targetType,
    target_id: params.targetId,
    is_enabled: params.isEnabled,
    updated_at: new Date().toISOString()
  }, { onConflict: 'flag_id,target_type,target_id' })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'add_flag_override',
    target_type: 'feature_flag',
    target_id: params.flagId,
    new_state: { target_type: params.targetType, target_id: params.targetId, is_enabled: params.isEnabled }
  })

  revalidatePath(`/admin/feature-flags/${params.flagId}`)
  return { success: true, data: null }
})

export const removeFlagOverride = adminAction(async (params: { overrideId: string, flagId: string }, ctx) => {
  const adminSupabase = getAdminSupabase()

  const { error } = await adminSupabase.from('feature_flag_overrides').delete().eq('id', params.overrideId)
  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'remove_flag_override',
    target_type: 'feature_flag',
    target_id: params.flagId,
    new_state: { override_id: params.overrideId } // Using new_data instead of old_state as that is the type requirement
  })

  revalidatePath(`/admin/feature-flags/${params.flagId}`)
  return { success: true, data: null }
})
