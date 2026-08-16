import { PaymentProvider, CreateCheckoutParams, CheckoutResponse, VerifyResponse, RefundResponse } from '../types'

/**
 * A mock provider for local development. 
 * Instead of redirecting to a real gateway, it simply returns a fake payment URL
 * which you can "visit" in your local browser to trigger a successful webhook simulation.
 */
export class MockPaymentProvider implements PaymentProvider {
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    const transactionId = `MOCK_TXN_${Date.now()}`
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      success: true,
      transactionId,
      // In a real dev environment, you'd navigate here to simulate payment
      paymentUrl: `http://localhost:3000/api/mock-payment?invoice_id=${params.invoiceId}&txn_id=${transactionId}`,
    }
  }

  async verifyPayment(transactionId: string): Promise<VerifyResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return {
      success: true,
      status: 'paid',
      transactionId,
      amount: 1000,
      currency: 'BDT'
    }
  }

  async refundPayment(transactionId: string, amount?: number): Promise<RefundResponse> {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return {
      success: true,
      transactionId,
      refundId: `MOCK_REFUND_${Date.now()}`
    }
  }
}
