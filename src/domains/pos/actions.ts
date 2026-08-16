'use server'

import { createClient } from '@/lib/supabase/server'
import { idempotentAction, hasPermission } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

export type POSCartItem = {
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

export type POSPayment = {
  account_id: string
  amount: number
}

export const processPOSSale = idempotentAction(async (data: {
  party_id?: string
  total_amount: number
  subtotal: number
  discount: number
  notes?: string
  items: POSCartItem[]
  payments: POSPayment[]
}, ctx) => {
  if (!hasPermission(ctx.role, 'sales.create')) {
    return { success: false, error: 'Permission Denied: Requires sales.create' }
  }

  const supabase = await createClient()

  // 1. Get the default branch
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('business_id', ctx.businessId)
    .limit(1)
    .single()

  if (!branch) {
    return { success: false, error: 'Branch not found.' }
  }

  // 2. Call the atomic RPC function
  const { data: transactionId, error } = await supabase.rpc('process_pos_sale', {
    p_business_id: ctx.businessId,
    p_branch_id: branch.id,
    p_party_id: data.party_id || null,
    p_total_amount: data.total_amount,
    p_subtotal: data.subtotal,
    p_discount: data.discount,
    p_notes: data.notes || null,
    p_user_id: ctx.userId,
    p_items: data.items,
    p_payments: data.payments
  })

  if (error) {
    console.error('POS RPC Error:', error)
    return { success: false, error: 'ফেইল হয়েছে: ' + error.message }
  }

  // 3. Revalidate everything affected
  revalidatePath('/dashboard')
  revalidatePath('/inventory')
  revalidatePath('/pos')

  return { success: true, data: transactionId }
})
