'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// Public Action: Get Storefront Profile by Slug
export async function getStorefrontProfileBySlug(slug: string) {
  const supabase = await createAdminClient()

  // Bypassing RLS because anonymous users cannot read the `businesses` table normally
  const { data, error } = await supabase
    .from('storefront_profiles')
    .select(`
      *,
      business:businesses (
        name,
        phone,
        address
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return { success: false, error: 'Storefront not found or inactive' }
  }

  return { success: true, data }
}

// Public Action: Get Published Products for a Business
export async function getStorefrontProducts(businessId: string) {
  const supabase = await createAdminClient()

  // Bypassing RLS for public catalog
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      barcode,
      category:product_categories(name),
      is_published_online,
      online_price
    `)
    .eq('business_id', businessId)
    .eq('is_published_online', true)
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// Public Action: Submit Online Order
export async function submitOnlineOrder(payload: {
  businessId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  items: Array<{ product_id: string, quantity: number, unit_price: number, subtotal: number }>
  totalAmount: number
  deliveryFee: number
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('submit_online_order', {
    p_business_id: payload.businessId,
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_delivery_address: payload.deliveryAddress,
    p_items: payload.items,
    p_total_amount: payload.totalAmount,
    p_delivery_fee: payload.deliveryFee
  })

  if (error) {
    console.error('submit_online_order error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, transactionId: data }
}
