'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CheckoutService } from '../checkout'
import { BillingService } from '../service'
import { redirect } from 'next/navigation'

export async function processCheckoutIntent(couponCode?: string) {
  const cookieStore = await cookies()
  const intentCookie = cookieStore.get('checkout_intent')?.value
  const businessIdCookie = cookieStore.get('active_business_id')?.value

  if (!intentCookie) {
    return { success: false, error: 'Checkout session expired or invalid' }
  }

  let intent
  try {
    intent = JSON.parse(intentCookie)
  } catch (e) {
    return { success: false, error: 'Invalid checkout intent' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // HARDEN: Verify business membership only if they have a business context
  if (businessIdCookie) {
    const { data: membership } = await supabase
      .from('business_members')
      .select('id')
      .eq('business_id', businessIdCookie)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'Unauthorized business access' }
    }
  }

  try {
    // 1. Look for existing unexpired session to prevent duplicate invoice spam
    let query = supabase
      .from('checkout_sessions')
      .select('id, status, invoice_id, invoices(payment_url)')
      .eq('user_id', user.id)
      .eq('plan_id', intent.planId)
      .eq('billing_cycle', intent.cycle)
      .in('status', ['pending', 'payment_started'])
      .gt('expires_at', new Date().toISOString())
      
    if (businessIdCookie) {
      query = query.eq('business_id', businessIdCookie)
    } else {
      query = query.is('business_id', null)
    }

    const { data: existingSession } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingSession) {
      const invoice = Array.isArray(existingSession.invoices) ? existingSession.invoices[0] : existingSession.invoices;
      if (existingSession.status === 'payment_started' && invoice?.payment_url) {
        // Resume existing payment
        
        if (!businessIdCookie && existingSession.business_id) {
          cookieStore.set('active_business_id', existingSession.business_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
          })
        }

        cookieStore.delete('checkout_intent')
        return { success: true, paymentUrl: invoice.payment_url }
      }
      
      if (existingSession.status === 'pending') {
        // Restart payment flow for pending session
        const billingService = new BillingService()
        const result = await billingService.startSessionPayment(
          existingSession.id,
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/app/checkout/success?session_id=${existingSession.id}`
        )
        
        if (!businessIdCookie && result.businessId) {
          cookieStore.set('active_business_id', result.businessId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
          })
        }

        cookieStore.delete('checkout_intent')
        return { success: true, paymentUrl: result.paymentUrl }
      }
    }

    // 2. Create the secure session if no resumable session exists
    const checkoutService = new CheckoutService()
    const session = await checkoutService.createSession({
      userId: user.id,
      businessId: businessIdCookie,
      planId: intent.planId,
      billingCycle: intent.cycle,
      couponCode: couponCode || undefined
    })

    // 2. Start the payment
    const billingService = new BillingService()
    const result = await billingService.startSessionPayment(
      session.id,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/app/checkout/success?session_id=${session.id}`
    )

    // 3. Set the business_id cookie if we provisioned a skeleton business
    if (!businessIdCookie && result.businessId) {
      cookieStore.set('active_business_id', result.businessId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      })
    }

    // 4. Clear intent cookie on success
    cookieStore.delete('checkout_intent')

    return { success: true, paymentUrl: result.paymentUrl }
  } catch (error: any) {
    console.error('Checkout error:', error)
    return { success: false, error: error.message || 'Failed to process checkout' }
  }
}

export async function validateCouponAction(couponCode: string, planId: string, baseAmount: number) {
  const cookieStore = await cookies()
  const businessIdCookie = cookieStore.get('active_business_id')?.value

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  if (businessIdCookie) {
    const { data: membership } = await supabase
      .from('business_members')
      .select('id')
      .eq('business_id', businessIdCookie)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'Unauthorized business access' }
    }
  }

  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: couponCode,
    p_business_id: businessIdCookie || null,
    p_plan_id: planId
  })

  if (error) {
    console.error('Validation RPC error:', error)
    return { success: false, error: 'Failed to validate coupon' }
  }

  const result = data as any
  if (!result.valid) {
    return { success: false, error: result.error || 'Invalid coupon' }
  }

  // Compute discount
  let discountAmount = 0
  if (result.type === 'percentage') {
    discountAmount = Math.round(baseAmount * (result.value / 100))
  } else if (result.type === 'fixed') {
    discountAmount = result.value
  }

  // Ensure discount doesn't exceed base amount
  discountAmount = Math.min(discountAmount, baseAmount)
  const finalAmount = baseAmount - discountAmount

  return {
    success: true,
    discountAmount,
    finalAmount,
    couponCode: couponCode
  }
}

export async function getCheckoutSessionStatus(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Fetch session with joined plans and invoices
  const { data: session, error } = await supabase
    .from('checkout_sessions')
    .select(`
      id, status, business_id, invoice_id, expires_at,
      plans ( name ),
      businesses ( name )
    `)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (error || !session) {
    return { success: false, error: 'Session not found' }
  }

  let currentStatus = session.status

  // Safely expire abandoned sessions
  if (['pending', 'payment_started'].includes(currentStatus) && new Date(session.expires_at) < new Date()) {
    currentStatus = 'expired'
    await supabase.from('checkout_sessions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', session.id)
    if (session.invoice_id) {
      await supabase.from('invoices').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', session.invoice_id)
    }
  }

  let periodEnd = null
  let planName = session.plans ? (session.plans as any).name : ''

  if (currentStatus === 'paid' && session.invoice_id) {
    // If paid, fetch the active subscription period end
    const { data: invoice } = await supabase
      .from('invoices')
      .select('subscription_id')
      .eq('id', session.invoice_id)
      .single()

    if (invoice?.subscription_id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('current_period_end')
        .eq('id', invoice.subscription_id)
        .single()
      
      if (sub) {
        periodEnd = sub.current_period_end
      }
    }
  }

  return {
    success: true,
    status: currentStatus,
    planName,
    periodEnd,
    businessId: session.business_id,
    businessName: session.businesses ? (session.businesses as any).name : null
  }
}

export async function payRenewalAction(invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const billingService = new BillingService()
    const result = await billingService.payExistingInvoice(
      invoiceId, 
      user.id,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/app/checkout/success`
    )
    
    return { success: true, paymentUrl: result.paymentUrl }
  } catch (error: any) {
    console.error('Renewal checkout error:', error)
    return { success: false, error: error.message || 'Failed to process renewal checkout' }
  }
}
