import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export interface EntitlementsPayload {
  plan: {
    id: string
    name: string
    period_start: string
    period_end: string
  }
  features: Record<string, number | null>
  usage: Record<string, number>
}

/**
 * Core function to fetch a business's active entitlements.
 * Wrapped in React cache to prevent duplicate queries during a single Server Request cycle.
 */
export const getEntitlements = cache(async (businessId: string): Promise<EntitlementsPayload | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_business_entitlements', { p_business_id: businessId })

  if (error || !data) {
    console.error(`Failed to fetch entitlements for business ${businessId}:`, error)
    return null
  }

  return data as EntitlementsPayload
})

/**
 * Returns the active Plan object.
 */
export async function getPlan(businessId: string) {
  const data = await getEntitlements(businessId)
  return data?.plan || null
}

/**
 * Checks if a feature is enabled at all (for booleans) or if usage limit hasn't been reached (for numeric limits).
 * Returns true if the business has access, false otherwise.
 */
export async function canUseFeature(businessId: string, featureKey: string): Promise<boolean> {
  const data = await getEntitlements(businessId)
  if (!data) return false

  const limit = data.features[featureKey]
  
  // Feature not in plan -> disabled
  if (limit === undefined || limit === 0) return false
  
  // Unlimited -> enabled
  if (limit === null) return true

  // For boolean features (1 means enabled)
  if (limit === 1) return true

  // For metered features, check if current usage is below the limit
  const currentUsage = data.usage[featureKey] || 0
  return currentUsage < limit
}

/**
 * Returns the raw numeric limit for a feature.
 * Returns null if unlimited.
 * Returns 0 or undefined if the feature does not exist on the plan.
 */
export async function getLimit(businessId: string, featureKey: string): Promise<number | null | undefined> {
  const data = await getEntitlements(businessId)
  return data?.features[featureKey]
}

/**
 * Returns the current usage count for a feature in the active billing period.
 */
export async function getUsage(businessId: string, featureKey: string): Promise<number> {
  const data = await getEntitlements(businessId)
  return data?.usage[featureKey] || 0
}

/**
 * Calculates remaining usage for a metered feature.
 * Returns null if unlimited.
 * Returns 0 if exhausted or not available.
 */
export async function remainingUsage(businessId: string, featureKey: string): Promise<number | null> {
  const data = await getEntitlements(businessId)
  if (!data) return 0

  const limit = data.features[featureKey]
  
  if (limit === undefined || limit === 0) return 0
  if (limit === null) return null // Unlimited

  const currentUsage = data.usage[featureKey] || 0
  return Math.max(0, limit - currentUsage)
}
