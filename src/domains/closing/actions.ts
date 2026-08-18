'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction, requirePermission } from '@/lib/actions/safe-action'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

type ClosingStatus =
  | { status: 'closed'; closing: { id: string; expected_cash: number; actual_cash: number; difference: number; reason: string | null; closed_at: string; summary: any } }
  | { status: 'open'; summary: any }

export const getDailyClosingSummary = requirePermission(PERMISSIONS.CLOSING_MANAGE, authAction(async (data: { date: string }, ctx): Promise<import('@/types/api').ActionResponse<ClosingStatus>> => {
  const supabase = await createClient()

  // 1. Check if already closed
  const { data: existingClosing } = await supabase
    .from('daily_closings')
    .select('id, expected_cash, actual_cash, difference, reason, closed_at, summary')
    .eq('business_id', ctx.businessId)
    .eq('closing_date', data.date)
    .single()

  if (existingClosing) {
    return { success: true, data: { status: 'closed', closing: existingClosing as any } }
  }

  // 2. Fetch the summary securely via RPC
  const { data: summary, error } = await supabase.rpc('get_daily_closing_summary', {
    p_business_id: ctx.businessId,
    p_date: data.date
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: { status: 'open', summary } }
}))

export const closeDay = requirePermission(PERMISSIONS.CLOSING_MANAGE, authAction(async (data: {
  date: string
  actual_cash: number
  reason?: string
}, ctx) => {
  const supabase = await createClient()

  // 1. Recompute truth on the server
  const { data: summary, error: summaryError } = await supabase.rpc('get_daily_closing_summary', {
    p_business_id: ctx.businessId,
    p_date: data.date
  })

  if (summaryError || !summary) {
    return { success: false, error: 'Failed to calculate expected cash for closing.' }
  }

  const expected_cash = Number(summary.expected_cash || 0)
  const difference = data.actual_cash - expected_cash

  const { error } = await supabase
    .from('daily_closings')
    .insert({
      business_id: ctx.businessId,
      closing_date: data.date,
      expected_cash: expected_cash,
      actual_cash: data.actual_cash,
      difference: difference,
      reason: data.reason || null,
      summary: summary,
      closed_by: ctx.userId
    })

  if (error) {
    if (error.code === '23505') { // Unique violation
      return { success: false, error: 'This day has already been closed.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/closing')
  return { success: true, data: null }
}))
