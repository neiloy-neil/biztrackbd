'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

export const getParties = authAction(async (data: { type?: 'customer' | 'supplier' | 'both', search?: string }, ctx) => {
  const supabase = await createClient()

  let query = supabase
    .from('v_party_balances')
    .select('*')
    .eq('business_id', ctx.businessId)

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

  const { data: parties, error } = await query.order('current_due', { ascending: false })

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

export const getPartyTransactions = authAction(async (data: { id: string }, ctx) => {
  const supabase = await createClient()

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('business_id', ctx.businessId)
    .eq('party_id', data.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: transactions }
})

export const createParty = authAction(async (data: {
  type: 'customer' | 'supplier' | 'both',
  name: string,
  phone?: string,
  address?: string,
  opening_balance: number
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
      opening_balance: data.opening_balance
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/parties')
  return { success: true, data: party }
})
