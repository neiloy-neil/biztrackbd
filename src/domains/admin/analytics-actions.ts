'use server'

import { createAdminAuthClient } from '@/domains/auth/admin-actions'

export type BusinessUsageStat = {
  business_id: string
  business_name: string
  plan_id: string | null
  plan_name: string | null
  mrr: number | null
  total_transactions: number
  total_products: number
  total_sms: number | null
  total_ai_requests: number | null
  estimated_cost: number
}

export type PlatformUsageStat = {
  total_mrr: number
  total_cost: number
  gross_margin: number
  active_businesses: number
}

export type PlanProfitability = {
  plan_id: string
  plan_name: string
  active_subscriptions: number
  total_mrr: number
  total_cost: number
  margin: number
}

export async function getPlatformUsageStats(): Promise<{ success: boolean; data?: PlatformUsageStat; error?: string }> {
  const supabase = await createAdminAuthClient()

  const { data: hasPerm } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.plans.manage' })
  if (!hasPerm) return { success: false, error: 'Permission denied' }

  const { data, error } = await supabase
    .from('vw_business_usage_stats')
    .select('*')

  if (error || !data) {
    return { success: false, error: 'Failed to fetch stats' }
  }

  let totalMRR = 0
  let totalCost = 0
  let activeBusinesses = 0

  data.forEach((row: any) => {
    totalMRR += Number(row.mrr || 0)
    totalCost += Number(row.estimated_cost || 0)
    activeBusinesses++
  })

  return {
    success: true,
    data: {
      total_mrr: totalMRR,
      total_cost: totalCost,
      gross_margin: totalMRR - totalCost,
      active_businesses: activeBusinesses
    }
  }
}

export async function getPlanProfitability(): Promise<{ success: boolean; data?: PlanProfitability[]; error?: string }> {
  const supabase = await createAdminAuthClient()

  const { data: hasPerm } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.plans.manage' })
  if (!hasPerm) return { success: false, error: 'Permission denied' }

  const { data, error } = await supabase
    .from('vw_business_usage_stats')
    .select('*')

  if (error || !data) {
    return { success: false, error: 'Failed to fetch stats' }
  }

  const plansMap = new Map<string, PlanProfitability>()

  data.forEach((row: any) => {
    if (!row.plan_id) return // Skip businesses without active plans for plan-level profitability

    if (!plansMap.has(row.plan_id)) {
      plansMap.set(row.plan_id, {
        plan_id: row.plan_id,
        plan_name: row.plan_name || 'Unknown',
        active_subscriptions: 0,
        total_mrr: 0,
        total_cost: 0,
        margin: 0
      })
    }

    const p = plansMap.get(row.plan_id)!
    p.active_subscriptions++
    p.total_mrr += Number(row.mrr || 0)
    p.total_cost += Number(row.estimated_cost || 0)
    p.margin = p.total_mrr - p.total_cost
  })

  return { success: true, data: Array.from(plansMap.values()) }
}

export async function getHighBurnCustomers(): Promise<{ success: boolean; data?: BusinessUsageStat[]; error?: string }> {
  const supabase = await createAdminAuthClient()

  const { data: hasPerm } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.plans.manage' })
  if (!hasPerm) return { success: false, error: 'Permission denied' }

  const { data, error } = await supabase
    .from('vw_business_usage_stats')
    .select('*')

  if (error || !data) {
    return { success: false, error: 'Failed to fetch stats' }
  }

  // Filter businesses where cost > MRR, or cost > 80% of MRR
  const highBurn = data
    .map((row: any) => ({
      business_id: row.business_id,
      business_name: row.business_name,
      plan_id: row.plan_id,
      plan_name: row.plan_name,
      mrr: Number(row.mrr || 0),
      total_transactions: Number(row.total_transactions || 0),
      total_products: Number(row.total_products || 0),
      total_sms: Number(row.total_sms || 0),
      total_ai_requests: Number(row.total_ai_requests || 0),
      estimated_cost: Number(row.estimated_cost || 0)
    }))
    .filter(row => row.estimated_cost > (row.mrr * 0.8)) // Burn threshold > 80% MRR
    .sort((a, b) => b.estimated_cost - a.estimated_cost)

  return { success: true, data: highBurn }
}
