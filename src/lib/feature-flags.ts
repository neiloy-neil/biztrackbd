import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export const evaluateFeatureFlag = cache(async (flagId: string, businessId?: string) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.rpc('evaluate_feature_flag', {
    p_flag_id: flagId,
    p_business_id: businessId || null,
    p_user_id: user?.id || null
  })

  if (error) {
    console.error(`Error evaluating feature flag ${flagId}:`, error)
    return false
  }

  return !!data
})

// Client-side hooks would go in a separate file (e.g., FeatureFlagProvider.tsx) if needed,
// but server-first evaluation is preferred to prevent client tampering.
// For client components, you should evaluate on the server and pass the boolean down as a prop.
