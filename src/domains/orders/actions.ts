'use server'

import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/domains/auth/middleware'
import { revalidatePath } from 'next/cache'

export const getOnlineOrders = withAuth(async () => {
  const supabase = await createClient()

  const { data: resultData, error } = await supabase
    .from('transactions')
    .select(`
      id,
      total_amount,
      transaction_date,
      state,
      party:parties(name, phone),
      shipment:shipments(
        status,
        customer_name,
        customer_phone,
        delivery_address,
        shipping_cost
      )
    `)
    .eq('type', 'online_order')
    .order('transaction_date', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: resultData }
})

export const updateOrderStatus = withAuth(async (transactionId: string, newState: string) => {
  const supabase = await createClient()
  
  // Note: We need a complex state machine here to handle:
  // - Inventory deduction when marked as shipped
  // - Account transaction creation when marked as delivered (COD)
  // For V1, we will just update the states to reflect UI tracking
  
  const { error: txError } = await supabase
    .from('transactions')
    .update({ state: newState })
    .eq('id', transactionId)
    
  if (txError) return { success: false, error: txError.message }
  
  const { error: shError } = await supabase
    .from('shipments')
    .update({ status: newState })
    .eq('transaction_id', transactionId)
    
  if (shError) return { success: false, error: shError.message }

  revalidatePath('/app/orders')
  return { success: true }
})
