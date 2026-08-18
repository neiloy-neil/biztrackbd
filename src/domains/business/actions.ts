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

  // 4. Check for checkout intent
  const intentCookie = cookieStore.get('checkout_intent')?.value
  let redirectUrl = '/app/dashboard'

  if (intentCookie) {
    try {
      const intent = JSON.parse(intentCookie)
      if (intent.planId) {
        // Fetch the plan
        const { data: plan } = await supabase
          .from('plans')
          .select('id, price_monthly, limits')
          .eq('id', intent.planId)
          .single()
          
        if (plan) {
          if (plan.price_monthly === 0) {
            // Activate free subscription directly
            await supabase.from('business_subscriptions').insert({
              business_id: businessId,
              plan_id: plan.id,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(), // 10 years
              cancel_at_period_end: false,
              limits_snapshot: plan.limits
            })
            // Clear intent since we used it
            cookieStore.delete('checkout_intent')
            redirectUrl = '/app/dashboard'
          } else {
            // Send to checkout
            redirectUrl = `/app/checkout`
          }
        }
      }
    } catch (e) {
      console.error('Invalid checkout intent cookie')
    }
  }

  return { success: true, businessId, redirectUrl }
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
