'use server'

import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'
import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'

export const fetchPlatformAdminsAction = adminAction(PLATFORM_PERMISSIONS.ADMINS_MANAGE, async (_params: any, ctx: any) => {
  const supabase = ctx.adminClient
  
  const { data, error } = await supabase.rpc('get_platform_admins_list')
  if (error) {
    console.error('Error fetching platform admins:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
})

export const invitePlatformAdminAction = adminAction(PLATFORM_PERMISSIONS.ADMINS_MANAGE, async (params: { email: string, roleName: string }, ctx: any) => {
  const supabase = ctx.adminClient
  const adminAuthClient = ctx.adminClient
  
  // 1. Invite user or get existing user
  const { data: inviteData, error: inviteError } = await adminAuthClient.auth.admin.inviteUserByEmail(params.email)
  
  let userId = inviteData?.user?.id
  
  if (inviteError) {
    // Check if error is because user already exists
    if (inviteError.message.includes('already exists') || inviteError.status === 422) {
      // Fetch the existing user by attempting to get them from a secure RPC or we can just list users via admin API
      const { data: usersData, error: usersError } = await adminAuthClient.auth.admin.listUsers()
      if (usersError) return { success: false, error: 'Failed to look up existing user' }
      
      const existingUser = usersData.users.find((u: any) => u.email === params.email)
      if (!existingUser) return { success: false, error: 'User already exists but could not be resolved' }
      
      userId = existingUser.id
    } else {
      return { success: false, error: inviteError.message }
    }
  }

  if (!userId) return { success: false, error: 'Failed to obtain user ID' }

  // 2. Assign role
  const { error: assignError } = await supabase.rpc('assign_platform_admin_role', {
    p_user_id: userId,
    p_role_name: params.roleName
  })

  if (assignError) return { success: false, error: assignError.message }

  // 3. Log action
  await logPlatformAction({
    action: 'invite_admin',
    target_type: 'user',
    target_id: userId,
    new_state: { role: params.roleName, email: params.email }
  })

  revalidatePath('/admin/team')
  return { success: true, data: { userId } }
})

export const updatePlatformAdminRoleAction = adminAction(PLATFORM_PERMISSIONS.ADMINS_MANAGE, async (params: { userId: string, roleName: string }, ctx: any) => {
  const supabase = ctx.adminClient

  const { error } = await supabase.rpc('assign_platform_admin_role', {
    p_user_id: params.userId,
    p_role_name: params.roleName
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'update_admin_role',
    target_type: 'user',
    target_id: params.userId,
    new_state: { role: params.roleName }
  })

  revalidatePath('/admin/team')
  return { success: true, data: null }
})

export const removePlatformAdminAction = adminAction(PLATFORM_PERMISSIONS.ADMINS_MANAGE, async (params: { userId: string }, ctx: any) => {
  const supabase = ctx.adminClient

  const { error } = await supabase.rpc('remove_platform_admin', {
    p_user_id: params.userId
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'remove_admin',
    target_type: 'user',
    target_id: params.userId,
    new_state: { removed: true }
  })

  revalidatePath('/admin/team')
  return { success: true, data: null }
})
