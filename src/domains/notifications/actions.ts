'use server'

import { authAction } from '@/lib/actions/safe-action'
import { createClient } from '@/lib/supabase/server'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export const getUnreadNotifications = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  // Ensure alerts are generated fresh before fetching
  await supabase.rpc('generate_smart_alerts', { p_business_id: ctx.businessId })

  const { data: notifications, error } = await supabase
    .rpc('get_unread_notifications', { 
      p_business_id: ctx.businessId,
      p_user_id: ctx.userId
    })

  if (error) throw error

  return { success: true, data: notifications }
})

export const markNotificationAsRead = authAction(
  async (data: { id: string }, ctx) => {
    const supabase = await createClient()

    const { error } = await supabase
      .from('user_notification_reads')
      .upsert({ user_id: ctx.userId, notification_id: data.id }, { onConflict: 'user_id,notification_id' })

    if (error) throw error

    return { success: true, data: null }
  }
)

export const markAllNotificationsAsRead = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  // Fetch all unread notifications first to know which ones to mark as read
  const { data: unreads, error: fetchError } = await supabase
    .rpc('get_unread_notifications', { 
      p_business_id: ctx.businessId,
      p_user_id: ctx.userId
    })
    
  if (fetchError) throw fetchError
  if (!unreads || unreads.length === 0) return { success: true, data: null }

  const readsToInsert = unreads.map((n: any) => ({
    user_id: ctx.userId,
    notification_id: n.id
  }))

  const { error } = await supabase
    .from('user_notification_reads')
    .upsert(readsToInsert, { onConflict: 'user_id,notification_id' })

  if (error) throw error

  return { success: true, data: null }
})

export const triggerSystemAlert = authAction(async (data: { type: 'sync_failed' | 'system_incident', message: string }, ctx) => {
  const supabase = await createClient()

  // Ensure idempotency: Max 1 per hour for the same type to prevent spamming
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: recent, error: fetchError } = await supabase
    .from('notifications')
    .select('id')
    .eq('business_id', ctx.businessId)
    .eq('type', data.type)
    .gte('created_at', oneHourAgo)
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (recent) {
    return { success: true, data: { status: 'skipped_recent' } }
  }

  const { error } = await supabase
    .from('notifications')
    .insert({
      business_id: ctx.businessId,
      type: data.type,
      title: data.type === 'sync_failed' ? 'Offline Sync Failed' : 'System Incident',
      message: data.message
    })

  if (error) throw error

  return { success: true, data: { status: 'alert_created' } }
})
