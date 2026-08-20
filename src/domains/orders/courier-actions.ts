'use server'

import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/domains/auth/middleware'
import { SteadfastClient } from '@/lib/couriers/steadfast'
import { PathaoClient } from '@/lib/couriers/pathao'
import { revalidatePath } from 'next/cache'

// Save/Update a courier integration setting
export const saveIntegrationSettings = withAuth(async (payload: {
  provider: string
  apiKey: string
  apiSecret?: string
  storeId?: string
}) => {
  const supabase = await createClient()

  // Use the active_business_id from cookies
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) return { success: false, error: 'No active business selected' }

  const { error } = await supabase
    .from('business_integrations')
    .upsert({
      business_id: businessId,
      provider: payload.provider,
      api_key: payload.apiKey,
      api_secret: payload.apiSecret,
      store_id: payload.storeId,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id,provider' })

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/app/settings/integrations')
  return { success: true }
})

// Create a courier shipment from an order
export const createConsignment = withAuth(async (transactionId: string, provider: string) => {
  const supabase = await createClient()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) return { success: false, error: 'No active business selected' }

  // 1. Fetch integration credentials
  const { data: integ, error: intErr } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', businessId)
    .eq('provider', provider)
    .eq('is_active', true)
    .single()

  if (intErr || !integ) return { success: false, error: `No active integration found for ${provider}` }

  // 2. Fetch Order Data
  const { data: order, error: ordErr } = await supabase
    .from('transactions')
    .select(`
      id, total_amount, state,
      shipment:shipments(*)
    `)
    .eq('id', transactionId)
    .single()

  if (ordErr || !order) return { success: false, error: 'Order not found' }
  const shipment = order.shipment?.[0]
  if (!shipment) return { success: false, error: 'Shipment details not found for order' }

  let consignmentId = ''
  let trackingLink = ''

  // 3. Trigger Courier API
  try {
    if (provider === 'steadfast') {
      const client = new SteadfastClient(integ.api_key, integ.api_secret || '')
      const response = await client.createOrder({
        invoice: order.id.slice(0, 8).toUpperCase(),
        recipient_name: shipment.customer_name,
        recipient_phone: shipment.customer_phone,
        recipient_address: shipment.delivery_address,
        cod_amount: Number(order.total_amount)
      })
      
      consignmentId = response.consignment_id?.toString() || response.data?.consignment_id?.toString() || ''
      trackingLink = response.tracking_url || response.data?.tracking_url || ''
      
    } else if (provider === 'pathao') {
      const client = new PathaoClient(integ.api_key, integ.api_secret || '')
      // Needs storeId, city/zone info (mocking some defaults for v1)
      const response = await client.createOrder({
        store_id: integ.store_id || '',
        merchant_order_id: order.id.slice(0, 8).toUpperCase(),
        recipient_name: shipment.customer_name,
        recipient_phone: shipment.customer_phone,
        recipient_address: shipment.delivery_address,
        recipient_city: '1', // Dhaka
        recipient_zone: '1',
        delivery_type: 48,
        item_type: 2,
        item_quantity: 1,
        item_weight: 1,
        amount_to_collect: Number(order.total_amount)
      })
      
      consignmentId = response.data?.consignment_id?.toString() || ''
    }

    if (!consignmentId) {
      throw new Error('No consignment ID returned from courier API')
    }

    // 4. Save Tracking Info to DB and update state
    await supabase.from('shipments').update({
      courier_consignment_id: consignmentId,
      courier_tracking_link: trackingLink,
      status: 'shipped'
    }).eq('id', shipment.id)

    await supabase.from('transactions').update({
      state: 'shipped'
    }).eq('id', transactionId)

    revalidatePath('/app/orders')
    return { success: true, consignmentId }

  } catch (err: any) {
    return { success: false, error: err.message || 'Courier API failure' }
  }
})
