'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction, requirePermission } from '@/lib/actions/safe-action'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

// PERM-03: createProduct requires inventory.manage permission
export const createProduct = requirePermission(PERMISSIONS.INVENTORY_MANAGE, authAction(async (data: {
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

  const { data: productId, error } = await supabase.rpc('create_product_atomic', {
    p_business_id: ctx.businessId,
    p_name: data.name,
    p_sku: data.sku || null,
    p_barcode: data.barcode || null,
    p_category_id: data.category_id || null,
    p_price: data.price,
    p_cost: data.cost,
    p_unit: data.unit,
    p_min_stock: data.min_stock,
    p_supplier_id: data.supplier_id || null,
    p_image_url: data.image_url || null,
    p_initial_stock: data.initial_stock || 0,
    p_created_by: ctx.userId
  })

  if (error) {
    console.error('Failed to create product:', error)
    return { success: false, error: 'Product creation failed: ' + error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: { id: productId } }
}))

export const getProducts = authAction(async (data: { 
  search?: string, 
  lowStockOnly?: boolean,
  cursorName?: string,
  cursorId?: string,
  limit?: number
}, ctx) => {
  const supabase = await createClient()
  
  const limit = data.limit || 50

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
    .order('id')
    .limit(limit)

  if (data.cursorName && data.cursorId) {
    query = query.or(`name.gt.${data.cursorName},and(name.eq.${data.cursorName},id.gt.${data.cursorId})`)
  }

  if (data.search) {
    query = query.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%,barcode.ilike.%${data.search}%`)
  }

  // If lowStockOnly is true, we must filter at DB level, otherwise it will be inaccurate
  // Since we don't have a computed column, we can't easily filter current_stock <= min_stock in PostgREST unless we use an RPC.
  // We'll leave it as a known limitation for now or use the RPC we can create.
  // For now, if lowStockOnly is true, we don't paginate to avoid breaking the UI filter.
  if (data.lowStockOnly) {
    query = supabase
      .from('products')
      .select(`*, category:product_categories(name), supplier:parties(name)`)
      .eq('business_id', ctx.businessId)
      .is('deleted_at', null)
      .order('name')
    if (data.search) {
      query = query.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%,barcode.ilike.%${data.search}%`)
    }
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

// PERM-01: recordMovement requires inventory.manage permission
export const recordMovement = requirePermission(PERMISSIONS.INVENTORY_MANAGE, authAction(async (data: {
  product_id: string,
  type: 'in' | 'out' | 'adjustment',
  quantity: number,
  reason?: string
}, ctx) => {
  if (data.type === 'in' || data.type === 'out') {
    if (data.quantity <= 0) return { success: false, error: 'Quantity must be positive for in/out.' }
  } else if (data.type === 'adjustment') {
    if (data.quantity === 0) return { success: false, error: 'Adjustment quantity cannot be zero.' }
    if (!data.reason || data.reason.trim() === '') return { success: false, error: 'Reason is required for adjustments.' }
  }

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
}))
