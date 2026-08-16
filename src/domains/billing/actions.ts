'use server'

import { BillingService } from './service'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function startCheckoutAction(formData: FormData) {
  const planId = formData.get('plan_id') as string
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
    const session = await billingService.createSubscriptionCheckout(businessId, planId, returnUrl)
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
