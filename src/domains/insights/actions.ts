'use server'

import { authAction } from '@/lib/actions/safe-action'
import { createClient } from '@/lib/supabase/server'
import { PERMISSIONS } from '@/lib/auth/rbac'

export const getInsightsData = authAction(async (data: void, ctx) => {
  const supabase = await createClient()

  const { data: insightsData, error } = await supabase.rpc('get_actionable_insights', {
    p_business_id: ctx.businessId,
  })

  if (error) {
    throw error
  }

  return { success: true, data: insightsData }
})
