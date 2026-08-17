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
    metadata: metadata || null,
    is_read: false
  })

  if (error) {
    console.error('Failed to create platform notification:', error)
  }

  // Best effort revalidate
  revalidatePath('/admin/notifications')
}

export const markNotificationAsRead = adminAction(async (notificationId: string) => {
  const adminSupabase = getAdminSupabase()
  
  const { error } = await adminSupabase.from('platform_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true }
})

export const markAllNotificationsAsRead = adminAction(async (_params: void) => {
  const adminSupabase = getAdminSupabase()
  
  const { error } = await adminSupabase.from('platform_notifications')
    .update({ is_read: true })
    .eq('is_read', false)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true }
})

export const deleteNotification = adminAction(async (notificationId: string) => {
  const adminSupabase = getAdminSupabase()
  
  const { error } = await adminSupabase.from('platform_notifications')
    .delete()
    .eq('id', notificationId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/admin/notifications')
  return { success: true }
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
  return { success: true }
})
