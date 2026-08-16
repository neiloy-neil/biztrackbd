'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'

export const getFinancialSummary = authAction(async (data: { startDate: string, endDate: string }, ctx) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_financial_summary', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: result[0] || { total_income: 0, total_expense: 0, net_profit: 0, cash_in: 0, cash_out: 0 } }
})

export const getSalesAnalytics = authAction(async (data: { startDate: string, endDate: string }, ctx) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_sales_analytics', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: result[0] || { sales_by_day: [], sales_by_product: [], sales_by_category: [], sales_by_payment: [] } }
})

export const getExpenseAnalytics = authAction(async (data: { startDate: string, endDate: string }, ctx) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_expense_analytics', {
    p_business_id: ctx.businessId,
    p_start_date: data.startDate,
    p_end_date: data.endDate
  })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: result[0] || { expense_by_category: [], expense_trend: [] } }
})

export const getPartyDues = authAction(async (_, ctx) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_party_dues', {
    p_business_id: ctx.businessId
  })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: result[0] || { customer_dues: [], supplier_payables: [] } }
})

export const getInventoryAnalytics = authAction(async (_, ctx) => {
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('get_inventory_analytics', {
    p_business_id: ctx.businessId
  })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data: result[0] || { total_valuation: 0, low_stock_items: [], stock_valuation_list: [] } }
})
