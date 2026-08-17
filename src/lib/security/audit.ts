import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

type AuditLogInput = {
  action: string
  entity_type: string
  entity_id: string
  business_id: string
  user_id: string
  old_data?: Record<string, any>
  new_data?: Record<string, any>
}

type PlatformAuditLogInput = {
  action: string
  target_type: string
  target_id?: string
  old_state?: Record<string, any>
  new_state?: Record<string, any>
}

const sanitize = (obj?: Record<string, any>) => {
  if (!obj) return null
  const safeObj = { ...obj }
  const sensitiveKeys = ['password', 'token', 'secret', 'otp']
  for (const key of Object.keys(safeObj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      safeObj[key] = '[REDACTED]'
    }
  }
  return safeObj
}

export async function auditLog(data: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient()
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const { error } = await supabase
      .from('business_audit_logs')
      .insert({
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        business_id: data.business_id,
        user_id: data.user_id,
        old_data: sanitize(data.old_data),
        new_data: sanitize(data.new_data),
        ip_address: ip,
        user_agent: userAgent
      })

    if (error) {
      console.error('Audit Log DB Error:', error)
    }
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}

export async function logPlatformAction(data: PlatformAuditLogInput): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // Can't log platform action without a logged-in user

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const { error } = await supabase
      .from('platform_audit_logs')
      .insert({
        actor_id: user.id,
        action: data.action,
        target_type: data.target_type,
        target_id: data.target_id,
        old_state: sanitize(data.old_state),
        new_state: sanitize(data.new_state),
        ip_address: ip,
        user_agent: userAgent
      })

    if (error) {
      console.error('Platform Audit Log DB Error:', error)
    }
  } catch (err) {
    console.error('Failed to write platform audit log:', err)
  }
}
