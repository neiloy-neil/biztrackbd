'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function completeOnboarding(payload: {
  businessName: string
  category: string
  ownerName: string
  paymentMethods: string[]
  openingBalances: number[]
}) {
  const isRateLimited = await rateLimit('completeOnboarding')
  if (isRateLimited) {
    return { success: false, error: 'Too many requests. Please wait.' }
  }

  const supabase = await createClient()

  // 1. Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Call the RPC
  const { data: businessId, error: rpcError } = await supabase.rpc('complete_onboarding', {
    p_business_name: payload.businessName,
    p_category: payload.category,
    p_owner_name: payload.ownerName,
    p_payment_methods: payload.paymentMethods,
    p_opening_balances: payload.openingBalances
  })

  if (rpcError || !businessId) {
    console.error('RPC Error:', rpcError)
    return { success: false, error: 'Failed to complete setup.' }
  }

  // 3. Set the active business cookie
  const cookieStore = await cookies()
  cookieStore.set('active_business_id', businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })

  return { success: true, businessId }
}

export async function setActiveBusiness(businessId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  // Verify membership
  const { data } = await supabase
    .from('business_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .single()

  if (data) {
    const cookieStore = await cookies()
    cookieStore.set('active_business_id', businessId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })
    return { success: true }
  }
  return { success: false }
}
