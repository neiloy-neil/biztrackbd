export interface CreateCheckoutParams {
  invoiceId: string
  amount: number
  currency: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  returnUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface CheckoutResponse {
  success: boolean
  paymentUrl?: string
  transactionId?: string
  error?: string
}

export interface VerifyResponse {
  success: boolean
  status: 'paid' | 'unpaid' | 'failed' | 'pending'
  transactionId: string
  amount: number
  currency: string
  error?: string
}

export interface RefundResponse {
  success: boolean
  transactionId: string
  refundId?: string
  error?: string
}

export interface PaymentProvider {
  /**
   * Initializes a new payment session with the provider and returns a URL to redirect the user to.
   */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse>

  /**
   * Verifies the status of a payment directly with the provider.
   */
  verifyPayment(transactionId: string): Promise<VerifyResponse>

  /**
   * Refunds a successful payment.
   */
  refundPayment(transactionId: string, amount?: number): Promise<RefundResponse>

  /**
   * Fallback for providers that natively support automated recurring billing (e.g. Stripe).
   * Local Bangladeshi gateways usually do not support this, so they will throw an Error or return undefined.
   */
  createCustomer?(businessId: string, email: string): Promise<string>
  
  /**
   * Fallback for providers that natively support automated recurring billing.
   */
  cancelSubscription?(subscriptionId: string): Promise<boolean>
}
