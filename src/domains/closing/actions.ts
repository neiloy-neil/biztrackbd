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


export const getAccountBalancesForReconciliation = requirePermission(PERMISSIONS.CLOSING_MANAGE, authAction(async (data: { date: string }, ctx) => {
  const supabase = await createClient()

  // get_account_balances_up_to_date RPC call
  const { data: accounts, error } = await supabase.rpc('get_account_balances_up_to_date', {
    p_business_id: ctx.businessId,
    p_date: data.date
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: accounts }
}))


export const closeDay = requirePermission(PERMISSIONS.CLOSING_MANAGE, authAction(async (data: {
  date: string
  reconciliations: Array<{ account_id: string, actual_balance: number, reason?: string }>
}, ctx) => {
  const supabase = await createClient()

  const { data: accounts, error: balancesError } = await supabase.rpc('get_account_balances_up_to_date', {
    p_business_id: ctx.businessId,
    p_date: data.date
  })

  if (balancesError || !accounts) {
    return { success: false, error: 'Failed to calculate expected balances for closing.' }
  }

  const { data: summary, error: summaryError } = await supabase.rpc('get_daily_closing_summary', {
    p_business_id: ctx.businessId,
    p_date: data.date
  })

  if (summaryError || !summary) {
    return { success: false, error: 'Failed to generate closing summary.' }
  }

  const expected_cash = Number(summary.expected_cash || 0)
  
  const cashRec = data.reconciliations.find(r => 
    accounts.find((a: any) => a.account_id === r.account_id)?.account_type === 'cash'
  )
  const actual_cash = cashRec ? cashRec.actual_balance : expected_cash
  const difference = actual_cash - expected_cash
  
  const { data: closingRecord, error: closingError } = await supabase
    .from('daily_closings')
    .insert({
      business_id: ctx.businessId,
      closing_date: data.date,
      expected_cash: expected_cash,
      actual_cash: actual_cash,
      difference: difference,
      reason: cashRec?.reason || null,
      summary: summary,
      closed_by: ctx.userId
    })
    .select('id')
    .single()

  if (closingError) {
    if (closingError.code === '23505') {
      return { success: false, error: 'This day has already been closed.' }
    }
    return { success: false, error: closingError.message }
  }

  const reconPayload = data.reconciliations.map(rec => {
    const acc = accounts.find((a: any) => a.account_id === rec.account_id)
    const sysBal = acc ? Number(acc.system_balance) : 0
    return {
      business_id: ctx.businessId,
      branch_id: ctx.branchId,
      account_id: rec.account_id,
      closing_id: closingRecord.id,
      reconciliation_date: data.date,
      system_balance: sysBal,
      actual_balance: rec.actual_balance,
      difference: rec.actual_balance - sysBal,
      reason: rec.reason || null,
      created_by: ctx.userId
    }
  })

  if (reconPayload.length > 0) {
    const { error: recError } = await supabase
      .from('account_reconciliations')
      .insert(reconPayload)
      
    if (recError) {
      console.error('Failed to insert reconciliations:', recError)
    }
  }

  revalidatePath('/app/closing')
  return { success: true, data: null }
}))
