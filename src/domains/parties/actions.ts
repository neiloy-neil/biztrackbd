'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction, requirePermission } from '@/lib/actions/safe-action'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

export const getParties = authAction(async (data: { type?: 'customer' | 'supplier' | 'both', search?: string, cursorDue?: number, cursorId?: string, limit?: number }, ctx) => {
  const supabase = await createClient()

  const limit = data.limit || 50

  let query = supabase
    .from('v_party_balances')
    .select('*')
    .eq('business_id', ctx.businessId)
    .limit(limit)

  if (data.cursorDue !== undefined && data.cursorId) {
    query = query.or(`current_due.lt.${data.cursorDue},and(current_due.eq.${data.cursorDue},id.lt.${data.cursorId})`)
  }

  if (data.type) {
    if (data.type === 'both') {
      // no filter
    } else {
      query = query.eq('type', data.type)
    }
  }

  if (data.search) {
    query = query.ilike('name', `%${data.search}%`)
  }

  const { data: parties, error } = await query.order('current_due', { ascending: false }).order('id', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: parties }
})

export const getParty = authAction(async (data: { id: string }, ctx) => {
  const supabase = await createClient()

  const { data: party, error } = await supabase
    .from('v_party_balances')
    .select('*')
    .eq('business_id', ctx.businessId)
    .eq('id', data.id)
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: party }
})

export const getPartyTransactions = authAction(async (data: { id: string, cursorDate?: string, cursorCreatedAt?: string, limit?: number }, ctx) => {
  const supabase = await createClient()

  const limit = data.limit || 50

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('business_id', ctx.businessId)
    .eq('party_id', data.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (data.cursorDate && data.cursorCreatedAt) {
    query = query.or(`transaction_date.lt.${data.cursorDate},and(transaction_date.eq.${data.cursorDate},created_at.lt.${data.cursorCreatedAt})`)
  }

  const { data: transactions, error } = await query

  if (error) return { success: false, error: error.message }
  return { success: true, data: transactions }
})

export const deleteParty = requirePermission(PERMISSIONS.CUSTOMERS_MANAGE, authAction(async (data: { id: string }, ctx) => {
  const supabase = await createClient()

  const { data: party, error: fetchErr } = await supabase
    .from('parties')
    .select('current_due')
    .eq('id', data.id)
    .eq('business_id', ctx.businessId)
    .single()

  if (fetchErr || !party) return { success: false, error: 'Party not found.' }
  if (Number(party.current_due) !== 0)
    return { success: false, error: 'বাকি শূন্য না হলে মুছে ফেলা যাবে না।' }

  const { error } = await supabase
    .from('parties')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('business_id', ctx.businessId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/app/parties')
  return { success: true, data: null }
}))

// PERM-04: Only owner/manager with customers.manage or suppliers.manage can create parties
export const createParty = requirePermission(PERMISSIONS.CUSTOMERS_MANAGE, authAction(async (data: {
  type: 'customer' | 'supplier' | 'both',
  name: string,
  phone?: string,
  address?: string,
  opening_balance: number,
  credit_limit?: number
}, ctx) => {
  const supabase = await createClient()

  const { data: party, error } = await supabase
    .from('parties')
    .insert({
      business_id: ctx.businessId,
      type: data.type,
      name: data.name,
      phone: data.phone,
      address: data.address,
      opening_balance: data.opening_balance,
      credit_limit: data.credit_limit || 0
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/parties')
  return { success: true, data: party }
}))
