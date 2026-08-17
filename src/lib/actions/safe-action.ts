import { createClient } from '@/lib/supabase/server'
import { ActionResponse } from '@/types/api'
import { auditLog } from '../security/audit'
import { rateLimit } from '../security/rate-limit'

type AuthContext = {
  userId: string
  businessId: string
  role: string
}

/**
 * Ensures the user is authenticated and is a valid member of the requested business.
 * Usage:
 * export const myAction = authAction(async (data, ctx) => { ... })
 */
export function authAction<TInput, TOutput>(
  action: (data: TInput, ctx: AuthContext) => Promise<ActionResponse<TOutput>>
) {
  return async (
    data: TInput,
    businessId?: string
  ): Promise<ActionResponse<TOutput>> => {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const activeBusinessId = businessId || cookieStore.get('active_business_id')?.value

    if (!activeBusinessId) {
      return { success: false, error: 'No active business selected' }
    }

    // 1. Rate Limiting based on IP/User-Agent (Basic)
    const isRateLimited = await rateLimit('authAction')
    if (isRateLimited) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    const supabase = await createClient()

    // 2. Validate Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'Unauthorized: No active session' }
    }

    // 3. Validate Tenant Membership (Authorization)
    // Even though RLS protects data, checking here prevents unnecessary DB load and logic execution
    const { data: memberData, error: memberError } = await supabase
      .from('business_members')
      .select('role')
      .eq('business_id', activeBusinessId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      // Audit log the failed authorization attempt
      await auditLog({
        action: 'unauthorized_tenant_access_attempt',
        entity_type: 'business',
        entity_id: activeBusinessId,
        business_id: activeBusinessId,
        user_id: user.id
      })
      return { success: false, error: 'Forbidden: You do not have access to this business' }
    }

    // 4. Execute the actual action with the secure context
    try {
      const result = await action(data, {
        userId: user.id,
        businessId: activeBusinessId,
        role: memberData.role
      })
      return result
    } catch (e: any) {
      console.error('Server Action Error:', e)
      return { success: false, error: 'Internal Server Error' }
    }
  }
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: [
    'sales.create', 'sales.view', 'sales.edit',
    'expenses.create', 'expenses.view', 'expenses.edit',
    'customers.view', 'customers.manage',
    'suppliers.view', 'suppliers.manage',
    'products.manage', 'products.view',
    'inventory.manage',
    'reports.view', 'staff.view', 'staff.manage', 'settings.manage',
    'closing.manage'
  ],
  cashier: [
    'sales.create', 'sales.view',
    'customers.view', 'products.view',
    'closing.manage'
  ],
  staff: [
    'sales.view', 'customers.view', 'products.view'
  ]
}

export function hasPermission(role: string, permission: string): boolean {
  if (role === 'owner') return true
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes(permission)
}

/**
 * Enforces idempotency for sensitive operations (like financial transactions).
 * Prevents double-processing if a network retry occurs.
 */
export function idempotentAction<TInput, TOutput>(
  action: (data: TInput, ctx: AuthContext) => Promise<ActionResponse<TOutput>>
) {
  return authAction<TInput & { idempotencyKey: string }, TOutput>(async (data, ctx) => {
    const { idempotencyKey, ...payload } = data
    
    if (!idempotencyKey) {
      return { success: false, error: 'Idempotency key is required' }
    }

    const supabase = await createClient()

    // 1. Check if the idempotency key already exists for this business
    const { data: existingKey } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('key', idempotencyKey)
      .eq('business_id', ctx.businessId)
      .single()

    if (existingKey) {
      // If it exists and was successful, return the cached successful response
      if (existingKey.response_code === 200) {
        return existingKey.response_body as ActionResponse<TOutput>
      }
      return { success: false, error: 'This request is already being processed or previously failed.' }
    }

    // 2. Insert the key to lock it
    const { error: insertError } = await supabase
      .from('idempotency_keys')
      .insert({
        key: idempotencyKey,
        business_id: ctx.businessId,
        user_id: ctx.userId,
        request_path: 'server_action',
        request_params: payload
      })

    if (insertError) {
      // If insertion fails due to unique constraint, another request beat us to it
      if (insertError.code === '23505') {
        return { success: false, error: 'Duplicate request detected' }
      }
      return { success: false, error: 'Failed to process idempotency lock' }
    }

    // 3. Execute the actual action
    const result = await action(payload as TInput, ctx)

    // 4. Update the idempotency record with the result
    await supabase
      .from('idempotency_keys')
      .update({
        response_code: result.success ? 200 : 400,
        response_body: JSON.parse(JSON.stringify(result))
      })
      .eq('key', idempotencyKey)

    return result
  })
}

/**
 * Wrapper to enforce a specific permission before executing the action.
 * Can wrap either `authAction` or `idempotentAction`.
 */
export function requirePermission<TInput, TOutput>(
  permission: string,
  actionFn: (data: TInput, businessId?: string) => Promise<ActionResponse<TOutput>>
) {
  return async (data: TInput, businessId?: string): Promise<ActionResponse<TOutput>> => {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const activeBusinessId = businessId || cookieStore.get('active_business_id')?.value

    if (!activeBusinessId) return { success: false, error: 'No active business selected' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: memberData } = await supabase
      .from('business_members')
      .select('role')
      .eq('business_id', activeBusinessId)
      .eq('user_id', user.id)
      .single()

    if (!memberData) return { success: false, error: 'Forbidden' }

    if (!hasPermission(memberData.role, permission)) {
      await auditLog({
        action: 'permission_denied',
        entity_type: 'action',
        entity_id: user.id,
        business_id: activeBusinessId,
        user_id: user.id,
        new_data: { permission_requested: permission, user_role: memberData.role }
      })
      return { success: false, error: `Permission Denied: Requires ${permission}` }
    }

    return actionFn(data, businessId)
  }
}

/**
 * Enforces the user is a Platform Admin before executing the action.
 * Usage:
 * export const myAdminAction = adminAction(async (data, ctx) => { ... })
 */
export function adminAction<TInput, TOutput>(
  action: (data: TInput, ctx: { userId: string }) => Promise<ActionResponse<TOutput>>
) {
  return async (data: TInput): Promise<ActionResponse<TOutput>> => {
    const isRateLimited = await rateLimit('adminAction')
    if (isRateLimited) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    const supabase = await createClient()

    // 1. Validate Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized: No active session' }
    }

    // 2. Validate Platform Admin Status
    const { data: adminData, error: adminError } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      // Audit log the failed authorization attempt
      await auditLog({
        action: 'unauthorized_platform_admin_access_attempt',
        entity_type: 'platform',
        entity_id: user.id,
        business_id: null,
        user_id: user.id,
        new_data: { 
          request_type: 'admin_server_action',
          payload: data
        }
      })
      return { success: false, error: 'Forbidden: You do not have platform admin access' }
    }

    // 3. Execute the actual action with the secure context
    try {
      const result = await action(data, { userId: user.id })
      return result
    } catch (e: any) {
      console.error('Server Action Error:', e)
      return { success: false, error: 'Internal Server Error' }
    }
  }
}
