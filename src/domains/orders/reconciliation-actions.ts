'use server'

import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/domains/auth/middleware'
import { revalidatePath } from 'next/cache'

export const reconcileOrder = withAuth(async (
  orderId: string, 
  accountId: string, 
  payoutAmount: number, 
  courierCharge: number
) => {
  const supabase = await createClient()

  const { error } = await supabase.rpc('reconcile_cod_payout', {
    p_order_id: orderId,
    p_account_id: accountId,
    p_payout_amount: payoutAmount,
    p_courier_charge: courierCharge
  })

  if (error) {
    console.error('Reconciliation error:', error)
    return { success: false, error: error.message }
  }

  // Revalidate orders and ledger
  revalidatePath('/app/orders')
  revalidatePath('/app/ledger')
  revalidatePath('/app/dashboard')

  return { success: true }
})
