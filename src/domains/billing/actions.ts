'use server'

import { BillingService } from './service'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function startCheckoutAction(formData: FormData) {
  const planId = formData.get('plan_id') as string
  const promoCode = formData.get('promo_code') as string
  if (!planId) throw new Error('Plan ID is required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData, error: staffError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)

  if (staffError || !staffData || !staffData.length) {
    throw new Error('Could not identify active business. Are you assigned to a business?')
  }
  
  const businessId = staffData[0].business_id

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
    // You'd typically return the error to the frontend, but for simplicity we redirect to an error state or throw.
    throw new Error(error.message)
  }

  if (paymentUrl) {
    redirect(paymentUrl)
  }
}

export async function changePlanAction(formData: FormData) {
  const planId = formData.get('plan_id') as string
  if (!planId) throw new Error('Plan ID is required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).limit(1)
  if (!staffData || !staffData.length) throw new Error('No active business found')
  const businessId = staffData[0].business_id

  // Compare prices
  const { data: newPlan } = await supabase.from('plans').select('price_monthly').eq('id', planId).single()
  const { data: sub } = await supabase.from('subscriptions').select('plans(price_monthly)').eq('business_id', businessId).single()
  
  if (!newPlan || !sub) throw new Error('Could not verify plans')

  const currentPrice = Array.isArray(sub.plans) ? sub.plans[0]?.price_monthly : (sub.plans as any)?.price_monthly;

  if (newPlan.price_monthly >= (currentPrice || 0)) {
    // UPGRADE: Immediate charge
    return startCheckoutAction(formData)
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
    .select('*')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    
  if (error) {
    return { success: false as const, error: error.message }
  }
  
  return { success: true as const, data: invoices }
})
