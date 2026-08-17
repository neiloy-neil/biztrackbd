'use server'

import { createClient } from '@/lib/supabase/server'
import { idempotentAction, authAction, hasPermission } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

import { canUseFeature } from '@/domains/saas/entitlements'

export const createTransaction = idempotentAction(async (data: {
  type: 'sale' | 'expense' | 'payment_in' | 'payment_out',
  amount: number,
  account_id: string,
  category?: string,
  party_id?: string,
  new_party_name?: string,
  notes?: string,
  attachments?: string[]
}, ctx) => {
  const canAddTransaction = await canUseFeature(ctx.businessId, 'transactions_per_month')
  if (!canAddTransaction) {
    return { success: false, error: 'Upgrade required: You have reached the maximum number of transactions for your current plan.' }
  }

  if (data.amount <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' }
  }

  // Permission Check
  if (['sale', 'payment_in'].includes(data.type) && !hasPermission(ctx.role, 'sales.create')) {
    return { success: false, error: 'Permission Denied: Requires sales.create' }
  }
  if (['expense', 'payment_out'].includes(data.type) && !hasPermission(ctx.role, 'expenses.create')) {
    return { success: false, error: 'Permission Denied: Requires expenses.create' }
  }

  const supabase = await createClient()

  // First, verify the account belongs to the business
  const { data: account, error: accError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', data.account_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (accError || !account) {
    return { success: false, error: 'Invalid payment account.' }
  }

  // Get the default branch
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('business_id', ctx.businessId)
    .limit(1)
    .single()

  if (!branch) {
    return { success: false, error: 'Branch not found.' }
  }
  
  let finalPartyId = data.party_id || null

  // Auto-create new party if requested
  if (data.new_party_name && !finalPartyId) {
    const { data: newParty, error: partyError } = await supabase
      .from('parties')
      .insert({
        business_id: ctx.businessId,
        type: data.type === 'sale' ? 'customer' : 'supplier',
        name: data.new_party_name.trim()
      })
      .select('id')
      .single()
      
    if (partyError) {
      return { success: false, error: 'Failed to create new party.' }
    }
    finalPartyId = newParty.id
  }

  const { data: transactionId, error: txnError } = await supabase.rpc('create_transaction_atomic', {
    p_business_id: ctx.businessId,
    p_branch_id: branch.id,
    p_type: data.type,
    p_total_amount: data.amount,
    p_account_id: data.account_id,
    p_party_id: finalPartyId,
    p_category: data.category || null,
    p_notes: data.notes || null,
    p_attachments: data.attachments || null,
    p_created_by: ctx.userId
  })

  if (txnError) {
    console.error('Failed to create transaction:', txnError)
    return { success: false, error: 'Transaction failed: ' + txnError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  if (data.party_id) {
    revalidatePath(`/parties/${data.party_id}`)
  }

  return { success: true, data: { id: transactionId } }
})

export const getAccounts = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('business_id', ctx.businessId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: accounts }
})

export const getPartiesForSelect = authAction(async (data: { type?: 'customer' | 'supplier' }, ctx) => {
  const supabase = await createClient()
  let query = supabase
    .from('parties')
    .select('id, name, type, phone')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    
  if (data.type) {
    query = query.eq('type', data.type)
  }

  const { data: parties, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: parties }
})

export const getRecentCategories = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  
  const { data: txns } = await supabase
    .from('transactions')
    .select('category')
    .eq('business_id', ctx.businessId)
    .not('category', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
    
  if (!txns) return { success: true, data: [] }
  
  const uniqueCategories = Array.from(new Set(txns.map(t => t.category)))
  return { success: true, data: uniqueCategories }
})

export const getTransactionAudit = authAction(async (data: { id: string }, ctx) => {
  const supabase = await createClient()
  const { data: audit, error } = await supabase.rpc('get_transaction_audit', { p_transaction_id: data.id })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: audit }
})
