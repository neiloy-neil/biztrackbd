import { PaymentProvider, CreateCheckoutParams, CheckoutResponse, VerifyResponse, RefundResponse } from '../types'

/**
 * Concrete implementation for UddoktaPay.
 * Interacts with the UddoktaPay REST API to generate payment links and verify payments.
 */
export class UddoktaPayProvider implements PaymentProvider {
  private apiKey: string
  private baseUrl: string

  constructor() {
    // In production, these should be loaded from environment variables
    this.apiKey = process.env.UDDOKTAPAY_API_KEY || ''
    this.baseUrl = process.env.UDDOKTAPAY_BASE_URL || 'https://sandbox.uddoktapay.com/api'
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RT-UDDOKTAPAY-API-KEY': this.apiKey
        },
        body: JSON.stringify({
          full_name: params.customerName,
          email: params.customerEmail || 'no-reply@biztrack.com',
          amount: params.amount.toString(),
          metadata: {
            invoice_id: params.invoiceId,
            ...params.metadata
          },
          redirect_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/uddoktapay`
        })
      })

      const data = await response.json()

      if (!response.ok || !data.status) {
        return { success: false, error: data.message || 'Failed to create checkout session' }
      }

      return {
        success: true,
        paymentUrl: data.payment_url,
        // UddoktaPay doesn't usually return a tx ID immediately upon creation, 
        // it generates it after the user goes to the URL. We rely on the webhook.
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async verifyPayment(transactionId: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RT-UDDOKTAPAY-API-KEY': this.apiKey
        },
        body: JSON.stringify({ invoice_id: transactionId })
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          success: false, 
          status: 'failed', 
          transactionId, 
          amount: 0, 
          currency: 'BDT',
          error: data.message 
        }
      }

      return {
        success: true,
        status: data.status === 'COMPLETED' ? 'paid' : 'pending',
        transactionId: data.transaction_id || transactionId,
        amount: parseFloat(data.amount),
        currency: 'BDT'
      }
    } catch (error: any) {
      return { success: false, status: 'failed', transactionId, amount: 0, currency: 'BDT', error: error.message }
    }
  }

  async refundPayment(transactionId: string, amount?: number): Promise<RefundResponse> {
    // Note: UddoktaPay may not support automated refunds via API. 
    // This is a placeholder. If unsupported, we throw or return an error.
    return {
      success: false,
      transactionId,
      error: 'Refunds must be processed manually via the UddoktaPay dashboard.'
    }
  }
}
