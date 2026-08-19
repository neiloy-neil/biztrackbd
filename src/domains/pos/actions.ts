'use server'

import { createClient } from '@/lib/supabase/server'
import { idempotentAction } from '@/lib/actions/safe-action'
import { canCreateSales } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const POSCartItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  lot_id: z.string().uuid().optional(),
  quantity: z.number().positive()
})

const POSPaymentSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().positive()
})

const processPOSSaleSchema = z.object({
  party_id: z.string().uuid().optional(),
  new_party_name: z.string().optional(),
  new_party_phone: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(POSCartItemSchema).min(1),
  payments: z.array(POSPaymentSchema),
  branch_id: z.string().uuid().optional(),
  idempotencyKey: z.string()
})

export type POSCartItem = {
  product_id: string
  variant_id?: string
  lot_id?: string
  quantity: number
}

export type POSPayment = {
  account_id: string
  amount: number
}

export const processPOSSale = idempotentAction(async (rawData: {
  party_id?: string
  new_party_name?: string
  new_party_phone?: string
  discount: number
  notes?: string
  items: POSCartItem[]
  payments: POSPayment[]
  branch_id?: string
}, ctx) => {
  const parsed = processPOSSaleSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: 'Invalid payload: ' + parsed.error.issues[0].message }
  }
  const data = parsed.data

  if (!canCreateSales(ctx.role)) {
    return { success: false, error: 'Permission Denied: Requires sales.create' }
  }

  if (data.items.length === 0) {
    return { success: false, error: 'No items in cart.' }
  }

  const supabase = await createClient()

  let branchId = data.branch_id || ctx.branchId
  if (data.branch_id && data.branch_id !== ctx.branchId) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', data.branch_id)
      .eq('business_id', ctx.businessId)
      .maybeSingle()
    if (!branch) return { success: false, error: 'Branch not found.' }
    branchId = branch.id
  }

  if (!branchId) return { success: false, error: 'Active branch context missing.' }

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

  const productIds = data.items.map(i => i.product_id)
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, price, tax_meta')
    .in('id', productIds)
    .eq('business_id', ctx.businessId)

  if (prodErr || !products || products.length !== productIds.length) {
    return { success: false, error: 'One or more products not found.' }
  }

  const { data: taxProfile } = await supabase
    .from('business_tax_profiles')
    .select('*')
    .eq('business_id', ctx.businessId)
    .maybeSingle()

  const isVatEnabled = taxProfile?.vat_enabled === true
  const defaultPricingModel = taxProfile?.default_pricing_model || 'exclusive'
  const defaultVatRate = Number(taxProfile?.default_vat_rate || 0)

  let totalTaxableValue = 0
  let totalVatAmount = 0

  const priceMap = Object.fromEntries(products.map(p => [p.id, Number(p.price)]))
  const taxMap = Object.fromEntries(products.map(p => [p.id, p.tax_meta || {}]))

  const enrichedItems = data.items.map(item => {
    const pTax = taxMap[item.product_id] as any
    const isTaxable = pTax?.is_taxable ?? true
    const vatRate = isVatEnabled && isTaxable ? Number(pTax?.vat_rate ?? defaultVatRate) : 0
    const qty = item.quantity
    const unitPrice = priceMap[item.product_id]
    
    let total_price = qty * unitPrice
    let taxable_value = 0
    let vat_amount = 0

    if (isVatEnabled && vatRate > 0) {
      if (defaultPricingModel === 'exclusive') {
        taxable_value = total_price
        vat_amount = total_price * (vatRate / 100)
        total_price = taxable_value + vat_amount
      } else {
        // inclusive
        taxable_value = total_price / (1 + (vatRate / 100))
        vat_amount = total_price - taxable_value
      }
    } else {
      taxable_value = total_price
      vat_amount = 0
    }

    totalTaxableValue += taxable_value
    totalVatAmount += vat_amount

    return {
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      lot_id: item.lot_id || null,
      quantity: qty,
      unit_price: unitPrice,
      total_price: total_price, // Will be passed to the RPC
      // Storing these to update later
      taxable_value,
      vat_rate: vatRate,
      vat_amount
    }
  })

  const subtotal = enrichedItems.reduce((sum, i) => sum + i.total_price, 0)
  const totalAmount = Math.max(0, subtotal - (data.discount || 0))

  // 1. Process POS Sale using the core RPC
  const { data: transactionId, error } = await supabase.rpc('process_pos_sale', {
    p_business_id:  ctx.businessId,
    p_branch_id:    branchId,
    p_party_id:     partyId,
    p_total_amount: totalAmount,
    p_subtotal:     subtotal,
    p_discount:     data.discount || 0,
    p_notes:        data.notes || null,
    p_user_id:      ctx.userId,
    p_items:        enrichedItems.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      lot_id: i.lot_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price
    })),
    p_payments:     data.payments,
  })

  if (error) {
    console.error('POS RPC Error:', error)
    return { success: false, error: 'ফেইল হয়েছে: ' + error.message }
  }

  // 2. Post-RPC VAT Assignment
  if (isVatEnabled) {
    // Find the invoice that was created for this transaction
    const { data: tx } = await supabase.from('transactions').select('invoice_id').eq('id', transactionId).single()
    if (tx && tx.invoice_id) {
      // Generate the Tax Invoice Number via RPC
      const { data: taxInvoiceNum } = await supabase.rpc('generate_tax_invoice_number', { p_business_id: ctx.businessId })
      
      await supabase.from('invoices').update({
        tax_invoice_number: taxInvoiceNum,
        mushak_reference: 'Mushak-6.3',
        pricing_model_applied: defaultPricingModel,
        total_taxable_value: totalTaxableValue,
        total_vat_amount: totalVatAmount
      }).eq('id', tx.invoice_id)

      // Get the invoice items to attach line-level vat details
      const { data: invItems } = await supabase.from('invoice_items').select('id, product_id').eq('invoice_id', tx.invoice_id)
      if (invItems) {
        for (const it of invItems) {
          const enriched = enrichedItems.find(e => e.product_id === it.product_id)
          if (enriched) {
            await supabase.from('invoice_items').update({
              taxable_value: enriched.taxable_value,
              vat_rate: enriched.vat_rate,
              vat_amount: enriched.vat_amount
            }).eq('id', it.id)
          }
        }
      }
    }
  }

  revalidatePath('/app', 'layout')
  return { success: true, data: transactionId }
})
