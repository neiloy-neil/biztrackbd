import { createClient } from '@/lib/supabase/server'

type AuditLogInput = {
  action: string
  entity_type: string
  entity_id: string
  business_id: string
  user_id: string
  old_data?: Record<string, any>
  new_data?: Record<string, any>
}

/**
 * Creates an immutable audit log entry in the database.
 * Does NOT throw errors to prevent disrupting the main business flow if logging fails,
 * but logs to stderr for monitoring.
 */
export async function auditLog(data: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Sanitize data - strip out potential passwords or tokens
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

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        business_id: data.business_id,
        user_id: data.user_id,
        old_data: sanitize(data.old_data),
        new_data: sanitize(data.new_data)
      })

    if (error) {
      console.error('Audit Log DB Error:', error)
    }
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}
