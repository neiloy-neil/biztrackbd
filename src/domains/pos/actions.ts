'use server'

import { createClient } from '@/lib/supabase/server'
import { idempotentAction, hasPermission } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

// Only product_id + quantity sent to server; prices come from the DB.
export type POSCartItem = {
  product_id: string
  quantity: number
}

export type POSPayment = {
  account_id: string
  amount: number
}

export const processPOSSale = idempotentAction(async (data: {
  party_id?: string
  discount: number
  notes?: string
  items: POSCartItem[]
  payments: POSPayment[]
}, ctx) => {
  if (!hasPermission(ctx.role, 'sales.create')) {
    return { success: false, error: 'Permission Denied: Requires sales.create' }
  }

  const supabase = await createClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('business_id', ctx.businessId)
    .limit(1)
    .single()

  if (!branch) {
    return { success: false, error: 'Branch not found.' }
  }

  const { data: transactionId, error } = await supabase.rpc('process_pos_sale', {
    p_business_id: ctx.businessId,
    p_branch_id:   branch.id,
    p_party_id:    data.party_id || null,
    p_discount:    data.discount,
    p_notes:       data.notes || null,
    p_user_id:     ctx.userId,
    p_items:       data.items,
    p_payments:    data.payments
  })

  if (error) {
    console.error('POS RPC Error:', error)
    return { success: false, error: 'ফেইল হয়েছে: ' + error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/inventory')
  revalidatePath('/pos')

  return { success: true, data: transactionId }
})
