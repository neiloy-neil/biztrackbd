import { createClient } from '@supabase/supabase-js'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client — uses the SERVICE_ROLE key.
 * NEVER expose this on the client side.
 * Use only in server actions / API routes for admin-level operations
 * like creating users programmatically.
 */
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Logs a sensitive read action by a Platform Admin.
 * MUST be called with an AUTHENTICATED client (not service_role)
 * so that auth.uid() is properly resolved in PostgreSQL.
 */
export async function logSensitiveRead(
  authClient: SupabaseClient, 
  targetType: string, 
  targetId: string, 
  actionDesc: string
) {
  try {
    const { error } = await authClient.rpc('log_sensitive_read', {
      target_type: targetType,
      target_id: targetId,
      action_desc: actionDesc
    })
    if (error) console.error('Failed to log sensitive read:', error)
  } catch (err) {
    console.error('Exception logging sensitive read:', err)
  }
}

/**
 * Logs a Super Admin Impersonation event.
 */
export async function logAdminImpersonation(
  authClient: SupabaseClient, 
  targetBusinessId: string
) {
  await logSensitiveRead(authClient, 'business', targetBusinessId, 'admin_impersonation')
}
