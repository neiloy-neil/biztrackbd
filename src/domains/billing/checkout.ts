import { createAdminClient } from '@/lib/supabase/server'

export class CheckoutService {
  /**
   * Securely generates a checkout session on the server.
   * Calculates all prices, discounts, and taxes server-side, 
   * ensuring malicious browser payloads are ignored.
   */
  async createSession(payload: {
    userId: string
    businessId?: string // Null if hasn't onboarded yet
    planId: string
    billingCycle: 'monthly' | 'annual'
    couponCode?: string
  }) {
    const supabase = createAdminClient()

    // 1. Fetch Plan Details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', payload.planId)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found or inactive')
    }

    if (!plan.is_active) {
      throw new Error('Selected plan is no longer active')
    }

    // 2. Base Amount Calculation
    let baseAmount = payload.billingCycle === 'annual' ? plan.price_annual : plan.price_monthly
    let finalAmount = baseAmount
    let discountAmount = 0
    let validCouponId = null

    // 3. Coupon Validation & Discount Calculation
    if (payload.couponCode) {
      // Validate via RPC. If business_id is null, it skips per-business checks for now, 
      // which is fine since they haven't onboarded. It will be verified again upon redemption.
      const { data: validationResult, error: validationError } = await supabase.rpc('validate_coupon', {
        p_code: payload.couponCode,
        p_business_id: payload.businessId || null,
        p_plan_id: payload.planId
      })

      if (validationError || !validationResult?.valid) {
        throw new Error(validationResult?.error || 'Invalid promo code')
      }

      validCouponId = validationResult.coupon_id
      if (validationResult.type === 'percentage') {
        discountAmount = baseAmount * (validationResult.value / 100)
      } else if (validationResult.type === 'fixed') {
        discountAmount = validationResult.value
      }

      finalAmount = Math.max(0, baseAmount - discountAmount)
    }

    const taxAmount = 0 // Currently 0, extend here if tax is needed

    // 4. Create the Session
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24-hour expiration

    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .insert({
        user_id: payload.userId,
        business_id: payload.businessId || null,
        plan_id: payload.planId,
        billing_cycle: payload.billingCycle,
        base_amount: baseAmount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        currency: plan.currency,
        coupon_id: validCouponId,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (sessionError || !session) {
      throw new Error('Failed to create checkout session')
    }

    return session
  }
}
