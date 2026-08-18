'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'

export const getDashboardSummary = authAction(async (
  data: { startDate: string, endDate: string }, 
  ctx
) => {
  const supabase = await createClient()

  const { data: summary, error } = await supabase.rpc('get_dashboard_summary', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: summary }
})

export const getRecentTransactions = authAction(async (
  data: { limit: number },
  ctx
) => {
  const supabase = await createClient()

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      type,
      total_amount,
      transaction_date,
      parties ( name )
    `)
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    .limit(data.limit)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: transactions }
})

// UX-10 Fix: Compare current_stock <= min_stock per product, not a global threshold
export const getLowStockProducts = authAction(async (
  data: { limit: number },
  ctx
) => {
  const supabase = await createClient()

  const { data: lowStock, error } = await supabase
    .from('products')
    .select('id, name, current_stock, min_stock')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('current_stock', { ascending: true })
    .limit(data.limit)

  if (error) {
    return { success: false, error: error.message }
  }

  // Filter client-side: current_stock <= min_stock
  const atOrBelowMinStock = lowStock.filter(
    p => Number(p.current_stock) <= Number(p.min_stock)
  )

  const formattedStock = atOrBelowMinStock.map(p => ({
    id: p.id,
    name: p.name,
    currentStock: Number(p.current_stock),
    minStock: Number(p.min_stock)
  }))

  return { success: true, data: formattedStock }
})

export const getBusinessHealthScore = authAction(async (
  data: { startDate: string, endDate: string },
  ctx
) => {
  const supabase = await createClient()

  const { data: scoreData, error } = await supabase.rpc('get_business_health_score', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: scoreData }
})

export const getMoneyVisibility = authAction(async (
  _data: object,
  ctx
) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_money_visibility', {
    p_business_id: ctx.businessId
  })
  if (error) return { success: false, error: error.message }
  return { success: true, data: result }
})

export const getTrendData = authAction(async (
  data: { startDate: string, endDate: string },
  ctx
) => {
  const supabase = await createClient()

  const { data: trendData, error } = await supabase.rpc('get_trend_data', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const chartData = (trendData || []).map((row: any) => ({
    date: row.trend_date,
    sales: Number(row.sales),
    expenses: Number(row.expenses)
  }))

  return { success: true, data: chartData }
})
