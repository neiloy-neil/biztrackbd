'use server'

import { createAuthClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { SteadfastClient } from '@/lib/couriers/steadfast'
import { PathaoClient } from '@/lib/couriers/pathao'

export async function getIntegrationSettingsAction(businessId: string) {
  const supabase = await createAuthClient()

  // The RLS policy should ensure only owners can select
  const { data, error } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', businessId)

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function saveIntegrationSettings(payload: {
  provider: 'pathao' | 'steadfast',
  apiKey: string,
  apiSecret?: string,
  storeId?: string
}) {
  const supabase = await createAuthClient()
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) {
    return { error: 'No active business' }
  }

  const { error } = await supabase
    .from('business_integrations')
    .upsert(
      {
        business_id: businessId,
        provider: payload.provider,
        api_key: payload.apiKey,
        api_secret: payload.apiSecret || null,
        store_id: payload.storeId || null,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'business_id,provider' }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/settings/integrations`)
  return { success: true }
}

export async function toggleIntegrationAction(businessId: string, provider: 'pathao' | 'steadfast', isActive: boolean) {
  const supabase = await createAuthClient()
  
  const { error } = await supabase
    .from('business_integrations')
    .update({ is_active: isActive })
    .eq('business_id', businessId)
    .eq('provider', provider)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/settings/integrations`)
  return { success: true }
}

export async function createConsignment(transactionId: string, provider: 'pathao' | 'steadfast' | string) {
  const supabase = await createAuthClient()

  // Fetch the transaction & shipment details
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select(`
      id, business_id, grand_total, status,
      parties ( id, name, phone, address ),
      shipments ( id, courier_consignment_id )
    `)
    .eq('id', transactionId)
    .single()

  if (txError || !transaction) {
    return { error: txError?.message || 'Transaction not found' }
  }
  
  const shipmentId = transaction.shipments?.[0]?.id
  if (!shipmentId) {
    return { error: 'No shipment found for this order. Ensure it is a delivery order.' }
  }

  // Fetch integration keys
  const { data: integrations, error: intError } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', transaction.business_id)
    .eq('provider', provider)
    .eq('is_active', true)
    .single()

  if (intError || !integrations) {
    return { error: `${provider} integration is not active or configured properly.` }
  }

  let consignmentId = ''
  let trackingLink = ''

  try {
    if (provider === 'steadfast') {
      const client = new SteadfastClient(integrations.api_key, integrations.api_secret || '')
      const result = await client.createOrder({
        invoice: transaction.id.substring(0, 8), // just a short ID for demo
        recipient_name: transaction.parties?.name || 'Guest',
        recipient_phone: transaction.parties?.phone || '01700000000',
        recipient_address: transaction.parties?.address || 'Dhaka',
        cod_amount: transaction.grand_total
      })
      
      consignmentId = result.consignment_id
      trackingLink = result.tracking_link || `https://steadfast.com.bd/t/${consignmentId}`
    } else if (provider === 'pathao') {
      const client = new PathaoClient(integrations.api_key, integrations.api_secret || '')
      const result = await client.createOrder({
        store_id: integrations.store_id || '1',
        merchant_order_id: transaction.id.substring(0, 8),
        recipient_name: transaction.parties?.name || 'Guest',
        recipient_phone: transaction.parties?.phone || '01700000000',
        recipient_address: transaction.parties?.address || 'Dhaka',
        recipient_city: '1', // Dhaka city ID
        recipient_zone: '1', // Zone ID
        delivery_type: 48,
        item_type: 2,
        item_quantity: 1,
        item_weight: 1,
        amount_to_collect: transaction.grand_total
      })
      consignmentId = result.consignment_id
      // Pathao often has their own tracking format
    }
    
    // Update local shipment
    const { error: updateError } = await supabase
      .from('shipments')
      .update({ 
        courier_consignment_id: consignmentId,
        courier_tracking_link: trackingLink,
        status: 'shipped'
      })
      .eq('id', shipmentId)

    if (updateError) throw updateError
    
    // Also update transaction status to processing
    await supabase
      .from('transactions')
      .update({ status: 'processing' })
      .eq('id', transaction.id)

    revalidatePath(`/app/orders`)
    return { success: true, consignmentId }
    
  } catch (error: any) {
    return { error: error.message || 'Failed to create consignment' }
  }
}

export async function syncShipmentStatus(transactionId: string) {
  const supabase = await createAuthClient()

  // Fetch the shipment
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select(      id, business_id, status,
      shipments ( id, courier_consignment_id )
    \)
    .eq('id', transactionId)
    .single()

  if (txError || !transaction) {
    return { error: 'Transaction not found' }
  }

  const shipment = transaction.shipments?.[0]
  if (!shipment || !shipment.courier_consignment_id) {
    return { error: 'No courier consignment found' }
  }

  // Find active integration (assuming steadfast for now since it's most common, ideally we store provider on shipment)
  // To keep it robust, let's just query Steadfast for now as an MVP
  const { data: integrations } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', transaction.business_id)
    .eq('provider', 'steadfast')
    .eq('is_active', true)
    .single()

  if (integrations) {
    try {
      const client = new SteadfastClient(integrations.api_key, integrations.api_secret || '')
      const result = await client.getStatus(shipment.courier_consignment_id)
      
      if (result.delivery_status === 'delivered') {
        await supabase
          .from('shipments')
          .update({ status: 'delivered' })
          .eq('id', shipment.id)
          
        await supabase
          .from('transactions')
          .update({ status: 'delivered' })
          .eq('id', transaction.id)
          
        revalidatePath('/app/orders')
        return { success: true, status: 'delivered' }
      }
      return { success: true, status: result.delivery_status }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  return { error: 'No active integration found to sync status' }
}
