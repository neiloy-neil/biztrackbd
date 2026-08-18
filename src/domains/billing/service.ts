import { PaymentProvider } from './types'
import { MockPaymentProvider } from './providers/mock'
import { UddoktaPayProvider } from './providers/uddoktapay'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Factory to get the active payment provider based on environment config.
 */
function getActiveProvider(): PaymentProvider {
  const providerType = process.env.PAYMENT_PROVIDER || 'mock'
  
  switch (providerType.toLowerCase()) {
    case 'uddoktapay':
      return new UddoktaPayProvider()
    case 'mock':
    default:
      return new MockPaymentProvider()
  }
}

export class BillingService {
  private provider: PaymentProvider

  constructor() {
    this.provider = getActiveProvider()
  }

  /**
   * Starts payment from a server-created secure checkout session.
   */
  async startSessionPayment(sessionId: string, returnUrl: string) {
    const supabase = createAdminClient()
    
    // 1. Fetch checkout session
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Checkout session not found')
    }

    if (session.status !== 'pending') {
      throw new Error(`Checkout session is in invalid state: ${session.status}`)
    }

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('checkout_sessions').update({ status: 'expired' }).eq('id', sessionId)
      throw new Error('Checkout session has expired')
    }

    let businessId = session.business_id
    let business: any = null

    if (!businessId) {
      // 1.a Provision skeleton business for new user
      const { data: newBiz, error: newBizError } = await supabase
        .from('businesses')
        .insert({ name: 'My Business' })
        .select()
        .single()
      
      if (newBizError || !newBiz) throw new Error('Failed to provision business')
      
      // Link user as owner
      await supabase.from('business_members').insert({
        business_id: newBiz.id,
        user_id: session.user_id,
        role: 'owner'
      })

      await supabase.from('checkout_sessions').update({ business_id: newBiz.id }).eq('id', sessionId)
      
      businessId = newBiz.id
      business = newBiz
    } else {
      // 2. Fetch Business Details
      const { data: existingBiz, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()

      if (bizError || !existingBiz) {
        throw new Error('Business not found')
      }
      business = existingBiz
    }

    // 2.a Provision or fetch subscription
    let subscriptionId: string | null = null
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('business_id', businessId)
      .single()

    if (existingSub) {
      subscriptionId = existingSub.id
    } else {
      const { data: newSub, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          business_id: businessId,
          plan_id: session.plan_id,
          billing_cycle: session.billing_cycle,
          status: 'trialing',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString()
        })
        .select()
        .single()

      if (subError || !newSub) throw new Error('Failed to provision subscription')
      subscriptionId = newSub.id
    }

    // 3. Apply Promotional Credits (Optional extension here)
    let finalAmount = Number(session.final_amount)
    const { data: credits } = await supabase
      .from('promotional_credits')
      .select('*')
      .eq('business_id', session.business_id)
    
    if (credits) {
      const totalCredits = credits.reduce((sum: number, c: any) => sum + Number(c.amount), 0)
      finalAmount = Math.max(0, finalAmount - totalCredits)
    }

    // 4. Create Draft Invoice using session values
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        subscription_id: subscriptionId,
        plan_id: session.plan_id,
        amount_due: finalAmount,
        status: 'draft',
        due_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Failed to create draft invoice')
    }

    // 5. Create Provider Checkout Session
    const checkoutParams = {
      invoiceId: invoice.id,
      amount: finalAmount,
      currency: session.currency,
      customerName: business.name,
      returnUrl,
      cancelUrl: returnUrl,
      metadata: {
        business_id: businessId,
        plan_id: session.plan_id,
        invoice_id: invoice.id,
        coupon_id: session.coupon_id || ''
      }
    }

    const checkoutResponse = await this.provider.createCheckout(checkoutParams)

    if (!checkoutResponse.success) {
      await supabase.from('checkout_sessions').update({ status: 'failed' }).eq('id', sessionId)
      throw new Error(checkoutResponse.error || 'Payment provider rejected checkout creation')
    }

    // 6. Update session and invoice
    await supabase.from('checkout_sessions').update({ 
      status: 'payment_started',
      invoice_id: invoice.id,
      payment_provider: process.env.PAYMENT_PROVIDER || 'mock',
      provider_session_id: checkoutResponse.gatewayInvoiceId || null
    }).eq('id', sessionId)

    if (checkoutResponse.gatewayInvoiceId) {
      await supabase
        .from('invoices')
        .update({ 
          uddoktapay_invoice_id: checkoutResponse.gatewayInvoiceId,
          payment_url: checkoutResponse.paymentUrl
        })
        .eq('id', invoice.id)
    }

    return {
      invoiceId: invoice.id,
      paymentUrl: checkoutResponse.paymentUrl,
      businessId
    }
  }

  /**
   * Generates an invoice in the database and creates a payment session with the provider.
   * This is called when a business attempts to subscribe to a new plan or manually pays for renewal.
   */
  async createSubscriptionCheckout(businessId: string, planId: string, returnUrl: string, promoCode?: string) {
    const supabase = createAdminClient()
    
    // 1. Fetch Plan Details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found')
    }

    // 2. Fetch Business Details
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      throw new Error('Business not found')
    }

    let finalAmount = plan.price_monthly
    let validCouponId = null

    // Validate Coupon
    if (promoCode) {
      const { data: validationResult, error: validationError } = await supabase.rpc('validate_coupon', {
        p_code: promoCode,
        p_business_id: businessId,
        p_plan_id: planId
      })

      if (validationError || !validationResult?.valid) {
        throw new Error(validationResult?.error || 'Invalid promo code')
      }

      validCouponId = validationResult.coupon_id
      if (validationResult.type === 'percentage') {
        finalAmount = finalAmount - (finalAmount * (validationResult.value / 100))
      } else if (validationResult.type === 'fixed') {
        finalAmount = Math.max(0, finalAmount - validationResult.value)
      }
    }

    // Apply Promotional Credits
    const { data: credits } = await supabase
      .from('promotional_credits')
      .select('*')
      .eq('business_id', businessId)
    
    let totalCredits = 0
    if (credits) {
      totalCredits = credits.reduce((sum, c) => sum + Number(c.amount), 0)
      finalAmount = Math.max(0, finalAmount - totalCredits)
      // Note: A full implementation would deduct the credits, but we keep it simple for checkout generation.
    }

    // 3. Create Draft Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        amount_due: finalAmount,
        status: 'draft',
        due_date: new Date().toISOString(), // Due immediately for new subscriptions
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Failed to create draft invoice')
    }

    // 4. Create Provider Checkout Session
    const checkoutParams = {
      invoiceId: invoice.id,
      amount: finalAmount,
      currency: plan.currency,
      customerName: business.name,
      returnUrl,
      cancelUrl: returnUrl,
      metadata: {
        business_id: businessId,
        plan_id: planId,
        invoice_id: invoice.id,
        coupon_id: validCouponId || ''
      }
    }

    const checkoutResponse = await this.provider.createCheckout(checkoutParams)

    if (!checkoutResponse.success) {
      throw new Error(checkoutResponse.error || 'Payment provider rejected checkout creation')
    }

    // Update session with payment URL if possible
    // (Optional: currently we just rely on the returnUrl, but storing it is good)

    return {
      invoiceId: invoice.id,
      paymentUrl: checkoutResponse.paymentUrl
    }
  }

  /**
   * Generates a checkout for an existing draft/open invoice (e.g., for renewals).
   */
  async payExistingInvoice(invoiceId: string, userId: string, returnUrl: string) {
    const supabase = createAdminClient()

    // 1. Fetch Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, subscriptions(plan_id, billing_cycle), businesses(name)')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found')
    }

    if (invoice.status === 'paid') {
      throw new Error('Invoice is already paid')
    }

    const businessId = invoice.business_id
    const planId = invoice.subscriptions?.plan_id
    const billingCycle = invoice.subscriptions?.billing_cycle || 'monthly'
    const businessName = invoice.businesses?.name || 'Business'

    // Fetch plan to get currency
    const { data: plan } = await supabase.from('plans').select('currency').eq('id', planId).single()
    const currency = plan?.currency || 'BDT'

    // 2. Create a Checkout Session
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .insert({
        user_id: userId,
        business_id: businessId,
        plan_id: planId,
        billing_cycle: billingCycle,
        base_amount: invoice.amount_due,
        final_amount: invoice.amount_due,
        currency: currency,
        invoice_id: invoice.id,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (sessionError || !session) {
      throw new Error('Failed to create checkout session for renewal')
    }

    // 3. Create Provider Checkout Session
    const checkoutParams = {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: currency,
      customerName: businessName,
      returnUrl: `${returnUrl}?session_id=${session.id}`,
      cancelUrl: `${returnUrl}?session_id=${session.id}`,
      metadata: {
        business_id: businessId,
        plan_id: planId,
        invoice_id: invoice.id
      }
    }

    const checkoutResponse = await this.provider.createCheckout(checkoutParams)

    if (!checkoutResponse.success) {
      throw new Error(checkoutResponse.error || 'Payment provider rejected checkout creation')
    }

    return {
      sessionId: session.id,
      paymentUrl: checkoutResponse.paymentUrl
    }
  }

  /**
   * Processes an incoming webhook from the payment provider.
   * Updates the invoice status, and provisions/extends the subscription.
   */
  async processPaymentWebhook(transactionId: string, metadata: Record<string, string>) {
    const supabase = createAdminClient()
    
    // 1. Verify payment validity directly with provider
    const verification = await this.provider.verifyPayment(transactionId)

    if (!verification.success || verification.status !== 'paid') {
      return { success: false, reason: 'Payment verification failed or not paid' }
    }

    const invoiceId = metadata.invoice_id
    const businessId = metadata.business_id
    const planId = metadata.plan_id

    if (!invoiceId || !businessId || !planId) {
      throw new Error('Missing critical metadata in webhook')
    }

    // 2. Cross-verify with internal checkout_session and invoice
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('*, invoices(amount_due, currency)')
      .eq('invoice_id', invoiceId)
      .single()

    if (sessionError || !session) {
      return { success: false, reason: 'Checkout session not found for this invoice' }
    }

    // Verify amount and currency (allowing minor floating point diffs)
    const expectedAmount = Number(session.invoices.amount_due)
    if (Math.abs(Number(verification.amount) - expectedAmount) > 0.1) {
      return { success: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${verification.amount}` }
    }

    // Currency verification is highly recommended
    if (verification.currency && verification.currency.toUpperCase() !== session.invoices.currency.toUpperCase()) {
      return { success: false, reason: `Currency mismatch: expected ${session.invoices.currency}, got ${verification.currency}` }
    }

    // 3. Process via Atomic RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_payment_webhook', {
      p_uddoktapay_invoice_id: transactionId,
      p_status: 'COMPLETED',
      p_amount: verification.amount,
      p_idempotency_key: transactionId
    })

    if (rpcError) {
      console.error('Webhook RPC Failed:', rpcError)
      return { success: false, reason: 'Database processing failed' }
    }

    if (rpcResult && !rpcResult.ok) {
      return { success: false, reason: rpcResult.reason || 'RPC rejected webhook' }
    }

    // 4. Redeem Coupon if applicable (Post-payment side effect)
    if (metadata.coupon_id) {
      const { data: coupon } = await supabase.from('coupons').select('code').eq('id', metadata.coupon_id).single()
      if (coupon) {
        await supabase.rpc('redeem_coupon', {
          p_code: coupon.code,
          p_business_id: businessId,
          p_plan_id: planId
        })
      }
    }

    return { success: true }
  }
}
