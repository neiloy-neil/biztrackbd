'use server'

import { BillingService } from './service'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Helper: throws if the current user is not the owner of their business
async function requireOwnerRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: memberData } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!memberData) throw new Error('No active business found')
  if (memberData.role !== 'owner') throw new Error('Only the business owner can manage billing.')

  return { user, businessId: memberData.business_id }
}

export async function startCheckoutAction(formData: FormData) {
  const planId = formData.get('plan_id') as string
  const promoCode = formData.get('promo_code') as string
  if (!planId) throw new Error('Plan ID is required')

  // PERM-02: Only business owners can initiate subscription checkout
  const { businessId } = await requireOwnerRole()

  // Determine return URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const returnUrl = `${siteUrl}/app/settings/billing`

  const billingService = new BillingService()
  let paymentUrl: string | undefined

  try {
    const session = await billingService.createSubscriptionCheckout(businessId, planId, returnUrl, promoCode)
    paymentUrl = session.paymentUrl
  } catch (error: any) {
    console.error('Failed to start checkout:', error)
    throw new Error(error.message)
  }

  if (paymentUrl) {
    redirect(paymentUrl)
  }
}

export async function changePlanAction(formData: FormData) {
  const planId = formData.get('plan_id') as string
  const billingCycle = (formData.get('billing_cycle') as string) || 'monthly'

  if (!planId) throw new Error('Plan ID is required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).limit(1)
  if (!staffData || !staffData.length) throw new Error('No active business found')
  const businessId = staffData[0].business_id

  // Compare prices
  const { data: newPlan } = await supabase.from('plans').select('price_monthly, price_annual').eq('id', planId).single()
  if (!newPlan) throw new Error('Plan not found')

  const { data: sub } = await supabase.from('subscriptions').select('billing_cycle, plans(price_monthly, price_annual)').eq('business_id', businessId).maybeSingle()
  
  const currentPlanObj = sub ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) as any : null
  const currentCycle = sub?.billing_cycle || 'monthly'
  const currentPrice = currentPlanObj 
    ? (currentCycle === 'annual' ? currentPlanObj.price_annual : currentPlanObj.price_monthly) 
    : 0

  const newPrice = billingCycle === 'annual' ? newPlan.price_annual : newPlan.price_monthly

  if (newPrice >= currentPrice) {
    // UPGRADE: Redirect to Checkout Flow
    // Save the intent as a cookie 
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set('checkout_intent', JSON.stringify({ planId, cycle: billingCycle }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    })

    redirect('/app/checkout')
  } else {
    // DOWNGRADE: Schedule for next period
    const { error } = await supabase.from('subscriptions').update({ scheduled_plan_id: planId }).eq('business_id', businessId)
    if (error) throw new Error('Failed to schedule downgrade')
  }
}

export async function cancelSubscriptionAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).limit(1)
  if (!staffData || !staffData.length) throw new Error('No active business found')
  
  const { error } = await supabase.from('subscriptions').update({ 
    cancel_at_period_end: true,
    canceled_at: new Date().toISOString()
  }).eq('business_id', staffData[0].business_id)

  if (error) throw new Error(error.message)
}

export async function resumeSubscriptionAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).limit(1)
  if (!staffData || !staffData.length) throw new Error('No active business found')
  
  const { error } = await supabase.from('subscriptions').update({ 
    cancel_at_period_end: false,
    canceled_at: null
  }).eq('business_id', staffData[0].business_id)

  if (error) throw new Error(error.message)
}

import { authAction } from '@/lib/actions/safe-action'

export const fetchInvoices = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, subscriptions(plans(name))')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    
  if (error) {
    return { success: false as const, error: error.message }
  }
  
  return { success: true as const, data: invoices }
})

export const fetchCredits = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  
  const { data: credits, error } = await supabase
    .from('promotional_credits')
    .select('*')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    
  if (error) {
    return { success: false as const, error: error.message }
  }
  
  return { success: true as const, data: credits }
})

export const fetchCouponRedemptions = authAction(async (data: void, ctx) => {
  const supabase = await createClient()
  
  const { data: redemptions, error } = await supabase
    .from('coupon_redemptions')
    .select('*, coupons(*)')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    
  if (error) {
    return { success: false as const, error: error.message }
  }
  
  return { success: true as const, data: redemptions }
})
