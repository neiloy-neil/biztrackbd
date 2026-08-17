'use server'

import { authAction } from '@/lib/actions/safe-action'
import { createClient } from '@/lib/supabase/server'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export const getUnreadNotifications = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  // Ensure alerts are generated fresh before fetching (or rely on cron)
  // For real-time freshness, we can trigger the RPC here, though it adds a little overhead
  await supabase.rpc('generate_smart_alerts', { p_business_id: ctx.businessId })

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('business_id', ctx.businessId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return { success: true, data: notifications }
})

export const markNotificationAsRead = authAction(
  async (data: { id: string }, ctx) => {
    const supabase = await createClient()

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', data.id)
      .eq('business_id', ctx.businessId)

    if (error) throw error

    return { success: true, data: null }
  }
)

export const markAllNotificationsAsRead = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('business_id', ctx.businessId)
    .eq('is_read', false)

  if (error) throw error

  return { success: true, data: null }
})
