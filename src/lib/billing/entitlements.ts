import { createClient } from '@/lib/supabase/server'

/**
 * Checks if a business has access to a specific feature.
 * If the limit is NULL, they have unlimited access.
 * If the limit is 0, they have no access.
 * If the limit is > 0, checks usage against the limit.
 */
export async function canUseFeature(businessId: string, featureKey: string): Promise<boolean> {
  const supabase = await createClient()

  // 1. Get the active subscription and plan feature limit
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      plans (
        plan_features ( feature_key, limit_value )
      )
    `)
    .eq('business_id', businessId)
    .eq('status', 'active')
    .single()

  // If no active subscription or error, assume no access (or fallback to free tier logic)
  if (error || !data) {
    return false;
  }

  // Find the feature limit for this plan
  // @ts-ignore
  const features = data.plans?.plan_features || []
  const feature = features.find((f: any) => f.feature_key === featureKey)

  if (!feature) {
    return false; // Feature not included in plan
  }

  const limit = feature.limit_value;

  if (limit === null) {
    return true; // Unlimited
  }

  if (limit === 0) {
    return false; // Disabled
  }

  // 2. If there's a strict numerical limit, check current usage
  const { data: usage } = await supabase
    .from('usage_records')
    .select('usage_count')
    .eq('business_id', businessId)
    .eq('feature_key', featureKey)
    .gte('period_end', new Date().toISOString())
    .lte('period_start', new Date().toISOString())
    .single()

  const currentUsage = usage?.usage_count || 0

  return currentUsage < limit
}

/**
 * Gets the current usage for a feature in the active billing period.
 */
export async function getUsage(businessId: string, featureKey: string): Promise<number> {
  const supabase = await createClient()
  
  const { data: usage } = await supabase
    .from('usage_records')
    .select('usage_count')
    .eq('business_id', businessId)
    .eq('feature_key', featureKey)
    .gte('period_end', new Date().toISOString())
    .lte('period_start', new Date().toISOString())
    .single()

  return usage?.usage_count || 0
}
