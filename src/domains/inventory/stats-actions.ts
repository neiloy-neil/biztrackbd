'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'

export const getInventoryStats = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  const { data: stats, error } = await supabase.rpc('get_inventory_stats', {
    p_business_id: ctx.businessId
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: stats }
})
