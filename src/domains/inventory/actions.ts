'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'
import { revalidatePath } from 'next/cache'

export const createProduct = authAction(async (data: {
  name: string,
  sku?: string,
  barcode?: string,
  category_id?: string,
  price: number,
  cost: number,
  unit: string,
  min_stock: number,
  initial_stock?: number,
  supplier_id?: string,
  image_url?: string
}, ctx) => {
  const supabase = await createClient()

  if (!data.name || data.price < 0 || data.cost < 0) {
    return { success: false, error: 'Invalid product details.' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      business_id: ctx.businessId,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      category_id: data.category_id || null,
      price: data.price,
      cost: data.cost,
      unit: data.unit,
      min_stock: data.min_stock,
      supplier_id: data.supplier_id || null,
      image_url: data.image_url
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (data.initial_stock && data.initial_stock > 0) {
    const { error: moveError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: product.id,
        business_id: ctx.businessId,
        type: 'adjustment',
        quantity: data.initial_stock,
        reason: 'প্রারম্ভিক স্টক (Initial Stock)',
        created_by: ctx.userId
      })
    
    if (moveError) {
      console.error('Failed to set initial stock:', moveError)
    }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
})

export const getProducts = authAction(async (data: { 
  search?: string, 
  lowStockOnly?: boolean 
}, ctx) => {
  const supabase = await createClient()
  
  let query = supabase
    .from('products')
    .select(`
      *,
      category:product_categories(name),
      supplier:parties(name)
    `)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('name')

  if (data.search) {
    query = query.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%,barcode.ilike.%${data.search}%`)
  }

  const { data: products, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  let finalProducts = products
  if (data.lowStockOnly) {
    finalProducts = products.filter(p => Number(p.current_stock) <= Number(p.min_stock))
  }

  return { success: true, data: finalProducts }
})

export const getProductHistory = authAction(async (data: { productId: string }, ctx) => {
  const supabase = await createClient()
  
  const { data: history, error } = await supabase
    .from('inventory_movements')
    .select(`
      *,
      transaction:transactions(reference, type)
    `)
    .eq('product_id', data.productId)
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: history }
})

export const recordMovement = authAction(async (data: {
  product_id: string,
  type: 'in' | 'out' | 'adjustment',
  quantity: number,
  reason?: string
}, ctx) => {
  const supabase = await createClient()

  // Verify product belongs to business
  const { data: product, error: pError } = await supabase
    .from('products')
    .select('id')
    .eq('id', data.product_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (pError || !product) {
    return { success: false, error: 'Product not found.' }
  }

  // Get default branch
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('business_id', ctx.businessId)
    .limit(1)
    .single()

  if (!branch) {
    return { success: false, error: 'Branch not found.' }
  }

  const { data: movement, error } = await supabase
    .from('inventory_movements')
    .insert({
      business_id: ctx.businessId,
      branch_id: branch.id,
      product_id: data.product_id,
      type: data.type,
      quantity: data.quantity,
      reason: data.reason,
      created_by: ctx.userId
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath(`/inventory/products/${data.product_id}`)

  return { success: true, data: movement }
})
