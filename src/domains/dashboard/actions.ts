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

export const getLowStockProducts = authAction(async (
  data: { threshold: number, limit: number },
  ctx
) => {
  const supabase = await createClient()

  // To find low stock efficiently without a materialized view:
  // We sum the inventory movements.
  // Note: For a true production app with 1M movements, this should use a materialized view.
  const { data: stock, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      inventory_movements ( type, quantity )
    `)
    .eq('business_id', ctx.businessId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Calculate current stock in memory (temporary until materialized view is created)
  const lowStock = stock.map(p => {
    let currentStock = 0
    p.inventory_movements.forEach((m: any) => {
      if (m.type === 'in') currentStock += Number(m.quantity)
      else if (m.type === 'out') currentStock -= Number(m.quantity)
      else if (m.type === 'adjustment') currentStock = Number(m.quantity) // Simplified assumption
    })
    return { id: p.id, name: p.name, currentStock }
  }).filter(p => p.currentStock <= data.threshold)
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, data.limit)

  return { success: true, data: lowStock }
})

export const getTrendData = authAction(async (
  data: { startDate: string, endDate: string },
  ctx
) => {
  const supabase = await createClient()

  // For a real production app, you'd want to use date_trunc in SQL to group by day.
  // Since we don't have a specific RPC for trend yet, we can fetch the transactions
  // and group them in memory since we are filtering by a small date range (e.g. month).
  const { data: txns, error } = await supabase
    .from('transactions')
    .select('type, total_amount, transaction_date')
    .eq('business_id', ctx.businessId)
    .in('type', ['sale', 'expense'])
    .gte('transaction_date', data.startDate)
    .lte('transaction_date', data.endDate)

  if (error) {
    return { success: false, error: error.message }
  }

  const grouped = txns.reduce((acc: any, txn) => {
    const date = txn.transaction_date.substring(5, 10) // MM-DD
    if (!acc[date]) {
      acc[date] = { date, sales: 0, expenses: 0 }
    }
    if (txn.type === 'sale') acc[date].sales += Number(txn.total_amount)
    if (txn.type === 'expense') acc[date].expenses += Number(txn.total_amount)
    return acc
  }, {})

  const chartData = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date))
  return { success: true, data: chartData }
})
