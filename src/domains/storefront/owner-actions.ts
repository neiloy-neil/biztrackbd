'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Owner Action: Get Storefront Settings
export async function getStorefrontSettings() {
  const supabase = await createClient()

  // Business context is handled by RLS if we query filtering by a session, but usually we filter by active_business_id
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) {
    return { success: false, error: 'No active business selected' }
  }

  const { data, error } = await supabase
    .from('storefront_profiles')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// Owner Action: Upsert Storefront Settings
export async function updateStorefrontSettings(payload: {
  slug: string
  themeColor: string
  isActive: boolean
  flatDeliveryFee: number
}) {
  const supabase = await createClient()
  
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) {
    return { success: false, error: 'No active business selected' }
  }

  const { error } = await supabase
    .from('storefront_profiles')
    .upsert({
      business_id: businessId,
      slug: payload.slug.toLowerCase().trim(),
      theme_color: payload.themeColor,
      is_active: payload.isActive,
      flat_delivery_fee: payload.flatDeliveryFee,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/app/settings/storefront')
  return { success: true }
}
