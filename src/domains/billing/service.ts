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
   * Generates an invoice in the database and creates a payment session with the provider.
   * This is called when a business attempts to subscribe to a new plan or manually pays for renewal.
   */
  async createSubscriptionCheckout(businessId: string, planId: string, returnUrl: string) {
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

    // 3. Create Draft Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        amount_due: plan.price_monthly,
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
      amount: plan.price_monthly,
      currency: plan.currency,
      customerName: business.name,
      returnUrl,
      cancelUrl: returnUrl,
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
      invoiceId: invoice.id,
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

    // 2. Mark Invoice as Paid
    const { error: updateInvoiceError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        amount_paid: verification.amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (updateInvoiceError) {
      console.error('Failed to update invoice status', updateInvoiceError)
    }

    // 3. Provision or Extend Subscription
    const periodStart = new Date()
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1) // Add 1 month

    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        business_id: businessId,
        plan_id: planId,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id' })

    if (subError) {
      throw new Error('Failed to provision subscription: ' + subError.message)
    }

    return { success: true }
  }
}
