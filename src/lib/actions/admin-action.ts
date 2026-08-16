import { createClient } from '@/lib/supabase/server'
import { ActionResponse } from '@/types/api'
import { rateLimit } from '../security/rate-limit'

type AdminContext = {
  userId: string
  role: string
}

/**
 * Ensures the user is authenticated and is a platform admin.
 * Usage:
 * export const myAdminAction = adminAction(async (data, ctx) => { ... })
 */
export function adminAction<TInput, TOutput>(
  action: (data: TInput, ctx: AdminContext) => Promise<ActionResponse<TOutput>>
) {
  return async (
    data: TInput
  ): Promise<ActionResponse<TOutput>> => {
    // 1. Rate Limiting based on IP/User-Agent (Basic)
    const isRateLimited = await rateLimit('adminAction')
    if (isRateLimited) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    const supabase = await createClient()

    // 2. Validate Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'Unauthorized: No active session' }
    }

    // 3. Validate Platform Admin
    const { data: adminData, error: adminError } = await supabase
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      return { success: false, error: 'Forbidden: You do not have platform admin privileges' }
    }

    // 4. Execute the actual action with the secure context
    try {
      const result = await action(data, {
        userId: user.id,
        role: adminData.role
      })
      return result
    } catch (e: any) {
      console.error('Server Admin Action Error:', e)
      return { success: false, error: 'Internal Server Error' }
    }
  }
}
