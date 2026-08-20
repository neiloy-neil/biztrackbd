import { createClient } from '@/lib/supabase/server'
import { ActionResponse } from '@/types/api'
import { auditLog } from '../security/audit'
import { rateLimit } from '../security/rate-limit'
import { logger } from '../observability/logger'
import crypto from 'crypto'

type AuthContext = {
  userId: string
  businessId: string
  branchId?: string
  role: string
  requestId: string
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

    // 3. Validate Tenant Membership + Business Status in one query
    const { data: memberData, error: memberError } = await supabase
      .from('business_members')
      .select('role, branch_id, businesses!inner(status)')
      .eq('business_id', activeBusinessId)
      .eq('user_id', user.id)
      .maybeSingle()
      
    let branchId = memberData?.branch_id
    if (!branchId && activeBusinessId) {
       // fallback to primary branch
       const { data: branch } = await supabase.from('branches').select('id').eq('business_id', activeBusinessId).limit(1).single()
       if (branch) branchId = branch.id
    }

    if (memberError || !memberData) {
      await auditLog({
        action: 'unauthorized_tenant_access_attempt',
        entity_type: 'business',
        entity_id: activeBusinessId,
        business_id: activeBusinessId,
        user_id: user.id
      })
      return { success: false, error: 'Forbidden: You do not have access to this business' }
    }

    const bizStatus = (memberData.businesses as any)?.status
    if (bizStatus !== 'active') {
      return { success: false, error: 'Your business account has been suspended. Please contact support.' }
    }

    const requestId = crypto.randomUUID()

    // 4. Execute the actual action with the secure context
    try {
      const result = await action(data, {
        userId: user.id,
        businessId: activeBusinessId,
        branchId,
        role: memberData.role,
        requestId
      })
      return result
    } catch (e: any) {
      logger.error('Unhandled Server Action Error', e, {
        requestId,
        userId: user.id,
        businessId: activeBusinessId,
        action: action.name || 'anonymous_action'
      })
      return { success: false, error: 'Internal Server Error', requestId }
    }
  }
}

import { ROLE_PERMISSIONS, hasPermission } from '@/lib/auth/rbac'

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

    // 1. Insert the key to lock it (atomic operation)
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
      // If insertion fails due to unique constraint, another request beat us to it (or it's a retry)
      if (insertError.code === '23505') {
        // Fetch the existing key to check if it has a cached successful response
        const { data: existingKey } = await supabase
          .from('idempotency_keys')
          .select('*')
          .eq('key', idempotencyKey)
          .eq('business_id', ctx.businessId)
          .single()

        if (existingKey && existingKey.response_code === 200) {
          return existingKey.response_body as ActionResponse<TOutput>
        }
        return { success: false, error: 'This request is already being processed or previously failed.' }
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

import { PlatformPermission, hasPlatformPermission } from '@/lib/auth/admin-rbac'
import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enforces the user is a Platform Admin and has the required permission before executing the action.
 * Usage:
 * export const myAdminAction = adminAction(PLATFORM_PERMISSIONS.USERS_VIEW, async (data, ctx) => { ... })
 */
export function adminAction<TInput, TOutput>(
  permission: PlatformPermission,
  action: (data: TInput, ctx: { userId: string, adminClient: SupabaseClient, authClient: SupabaseClient }) => Promise<ActionResponse<TOutput>>
) {
  return async (data: TInput): Promise<ActionResponse<TOutput>> => {
    const isRateLimited = await rateLimit('adminAction')
    if (isRateLimited) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    const authClient = await createAdminAuthClient()
    const adminClient = await createAdminClient()

    // 1. Validate Session using the Admin Auth Client
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized: No active admin session' }
    }

    // 2. Validate Platform Admin Status and Role
    const { data: adminData, error: adminError } = await adminClient
      .from('platform_admins')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      await auditLog({
        action: 'unauthorized_platform_admin_access_attempt',
        entity_type: 'platform',
        entity_id: user.id,
        business_id: 'PLATFORM',
        user_id: user.id,
        new_data: { request_type: 'admin_server_action', payload: data }
      })
      return { success: false, error: 'Forbidden: You do not have platform admin access' }
    }

    // 3. Validate Platform Permission
    if (!hasPlatformPermission(adminData.role, permission)) {
      await auditLog({
        action: 'unauthorized_platform_permission_attempt',
        entity_type: 'platform',
        entity_id: user.id,
        business_id: 'PLATFORM',
        user_id: user.id,
        new_data: { request_type: 'admin_server_action', permission_required: permission }
      })
      return { success: false, error: 'Forbidden: You lack the required platform permission' }
    }

    // 4. Execute the actual action with the secure context
    // authClient carries the user's JWT so auth.uid() works in SECURITY DEFINER RPCs.
    // adminClient (service-role) is for direct table operations that bypass RLS.
    try {
      const result = await action(data, { userId: user.id, adminClient, authClient })
      return result
    } catch (e: any) {
      logger.error('Admin Server Action Error', e, {
        userId: user.id,
        action: action.name || 'anonymous_admin_action'
      })
      return { success: false, error: 'Internal Server Error' }
    }
  }
}
