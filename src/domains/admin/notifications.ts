'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
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

export async function createPlatformNotification(
  type: string,
  priority: 'low' | 'normal' | 'high' | 'critical',
  title: string,
  message: string,
  targetUrl?: string,
  metadata?: any
) {
  // This might be called from internal systems (like cron), so we use a direct admin client.
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminSupabase.from('platform_notifications').insert({
    type,
    priority,
    title,
    message,
    target_url: targetUrl || null,
    metadata: metadata || null
  })

  if (error) {
    console.error('Failed to create platform notification:', error)
  }

  // Best effort revalidate
  revalidatePath('/admin/notifications')
}

export const markNotificationAsRead = adminAction(async (notificationId: string, ctx) => {
  const adminSupabase = getAdminSupabase()
  
  const { error } = await adminSupabase.from('admin_notification_reads')
    .upsert({ admin_id: ctx.userId, notification_id: notificationId, read_at: new Date().toISOString() })

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true, data: null }
})

export const markAllNotificationsAsRead = adminAction(async (_params: void, ctx) => {
  const adminSupabase = getAdminSupabase()
  
  // Find all platform notifications
  const { data: allNotifs } = await adminSupabase.from('platform_notifications').select('id')
  if (!allNotifs || allNotifs.length === 0) return { success: true, data: null }

  // Bulk insert reads
  const reads = allNotifs.map(n => ({
    admin_id: ctx.userId,
    notification_id: n.id,
    read_at: new Date().toISOString()
  }))

  const { error } = await adminSupabase.from('admin_notification_reads').upsert(reads, { onConflict: 'admin_id,notification_id' })

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true, data: null }
})

export const deleteNotification = adminAction(async (notificationId: string) => {
  const adminSupabase = getAdminSupabase()
  
  const { error } = await adminSupabase.from('platform_notifications')
    .delete()
    .eq('id', notificationId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true, data: null }
})

export const updateNotificationPreferences = adminAction(async (params: { emailNotifications: boolean, mutedTypes: string[] }, ctx) => {
  const adminSupabase = getAdminSupabase()

  const { error } = await adminSupabase.from('notification_preferences').upsert({
    admin_id: ctx.userId,
    email_notifications: params.emailNotifications,
    muted_types: params.mutedTypes,
    updated_at: new Date().toISOString()
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/notifications/preferences')
  return { success: true, data: null }
})
