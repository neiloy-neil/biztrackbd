import { createClient } from '@/lib/supabase/server'
import { createAdminAuthClient } from '@/domains/auth/admin-actions'

export async function businessAction<T>(action: (context: { user: any, businessId: string | null, supabase: any }) => Promise<T>): Promise<T> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Unauthorized: Business session required')
  }

  // Determine active business ID if present (could be from headers/cookies, depending on implementation)
  // For now, we return null, meaning the action should validate the target businessId
  return action({ user, businessId: null, supabase })
}

export async function adminAction<T>(
  requiredPermission: string,
  action: (context: { user: any, adminClient: any }) => Promise<T>
): Promise<T> {
  const adminClient = await createAdminAuthClient()
  const { data: { user }, error } = await adminClient.auth.getUser()
  
  if (error || !user) {
    throw new Error('Unauthorized: Admin session required')
  }

  // Validate the required permission using the new RBAC system
  const { data: hasPermission } = await adminClient.rpc('has_platform_permission', { required_permission: requiredPermission })

  if (!hasPermission) {
    throw new Error(`Forbidden: Missing required platform permission (${requiredPermission})`)
  }

  return action({ user, adminClient })
}
