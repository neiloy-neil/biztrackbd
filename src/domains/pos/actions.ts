'use server'

import { createClient } from '@/lib/supabase/server'
import { idempotentAction } from '@/lib/actions/safe-action'
import { canCreateSales } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

// Only product_id + quantity sent to server; prices come from the DB.
export type POSCartItem = {
  product_id: string
  quantity: number
}

export type POSPayment = {
  account_id: string
  amount: number
}

export const processPOSSale = idempotentAction(async (data: {
  party_id?: string
  new_party_name?: string
  new_party_phone?: string
  discount: number
  notes?: string
  items: POSCartItem[]
  payments: POSPayment[]
  branch_id?: string
}, ctx) => {
  if (!canCreateSales(ctx.role)) {
    return { success: false, error: 'Permission Denied: Requires sales.create' }
  }

  if (data.items.length === 0) {
    return { success: false, error: 'No items in cart.' }
  }

  const supabase = await createClient()

  // Resolve branch — use the client-selected branch if provided, otherwise
  // fall back to the first branch (single-branch businesses / offline replays).
  let branchId = data.branch_id || null
  if (!branchId) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    branchId = branch?.id ?? null
  } else {
    // Verify the provided branch belongs to this business (IDOR guard).
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('business_id', ctx.businessId)
      .maybeSingle()
    if (!branch) return { success: false, error: 'Branch not found.' }
  }

  if (!branchId) {
    return { success: false, error: 'Branch not found.' }
  }

  // Create new customer party if requested
  let partyId = data.party_id || null
  if (data.new_party_name && !partyId) {
    const { data: newParty, error: partyErr } = await supabase
      .from('parties')
      .insert({
        business_id: ctx.businessId,
        type: 'customer',
        name: data.new_party_name.trim(),
        phone: data.new_party_phone?.trim() || null,
      })
      .select('id')
      .single()

    if (partyErr || !newParty) {
      return { success: false, error: 'Failed to create customer: ' + (partyErr?.message ?? '') }
    }
    partyId = newParty.id
  }

  // Fetch current prices for all products in this business
  const productIds = data.items.map(i => i.product_id)
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, price')
    .in('id', productIds)
    .eq('business_id', ctx.businessId)

  if (prodErr || !products || products.length !== productIds.length) {
    return { success: false, error: 'One or more products not found.' }
  }

  const priceMap = Object.fromEntries(products.map(p => [p.id, Number(p.price)]))

  // Build enriched items for the RPC
  const enrichedItems = data.items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: priceMap[item.product_id],
    total_price: item.quantity * priceMap[item.product_id],
  }))

  const subtotal = enrichedItems.reduce((sum, i) => sum + i.total_price, 0)
  const totalAmount = Math.max(0, subtotal - (data.discount || 0))

  const { data: transactionId, error } = await supabase.rpc('process_pos_sale', {
    p_business_id:  ctx.businessId,
    p_branch_id:    branchId,
    p_party_id:     partyId,
    p_total_amount: totalAmount,
    p_subtotal:     subtotal,
    p_discount:     data.discount || 0,
    p_notes:        data.notes || null,
    p_user_id:      ctx.userId,
    p_items:        enrichedItems,
    p_payments:     data.payments,
  })

  if (error) {
    console.error('POS RPC Error:', error)
    return { success: false, error: 'ফেইল হয়েছে: ' + error.message }
  }

  revalidatePath('/app', 'layout')

  return { success: true, data: transactionId }
})
