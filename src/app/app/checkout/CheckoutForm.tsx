'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { processCheckoutIntent, validateCouponAction } from '@/domains/billing/actions/checkout'
import { Loader2, CheckCircle2, Tag } from 'lucide-react'

interface CheckoutFormProps {
  planId: string
  planName: string
  cycle: string
  baseAmount: number
  features: string[]
}

export function CheckoutForm({ planId, planName, cycle, baseAmount, features }: CheckoutFormProps) {
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [finalAmount, setFinalAmount] = useState(baseAmount)
  
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [couponMsg, setCouponMsg] = useState('')

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setValidating(true)
    setError('')
    setCouponMsg('')

    const res = await validateCouponAction(couponCode.trim(), planId, baseAmount)
    if (res.success && res.discountAmount !== undefined && res.finalAmount !== undefined) {
      setDiscountAmount(res.discountAmount)
      setFinalAmount(res.finalAmount)
      setAppliedCoupon(res.couponCode)
      setCouponMsg('Coupon applied successfully!')
    } else {
      setDiscountAmount(0)
      setFinalAmount(baseAmount)
      setAppliedCoupon('')
      setError(res.error || 'Invalid coupon')
    }
    setValidating(false)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await processCheckoutIntent(appliedCoupon || undefined)

    if (res.success && res.paymentUrl) {
      // Redirect to the payment gateway
      window.location.href = res.paymentUrl
    } else {
      setError(res.error || 'Checkout failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Plan Details Summary */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{planName}</h3>
            <p className="text-sm text-slate-500 capitalize">{cycle} billing</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-slate-900">৳{baseAmount}</div>
          </div>
        </div>
        
        {features.length > 0 && (
          <ul className="space-y-2 mt-4 border-t border-slate-200 pt-4">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Coupon Section */}
      <div className="space-y-3">
        <Label htmlFor="couponCode">Have a promo code?</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              id="couponCode"
              placeholder="Enter discount code" 
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value)
                if (appliedCoupon && e.target.value !== appliedCoupon) {
                  // User changed the code, clear the applied state
                  setAppliedCoupon('')
                  setDiscountAmount(0)
                  setFinalAmount(baseAmount)
                  setCouponMsg('')
                }
              }}
              className="pl-9 h-11"
              disabled={loading || validating}
            />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleApplyCoupon}
            disabled={!couponCode.trim() || validating || appliedCoupon === couponCode}
            className="h-11 px-6"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
          </Button>
        </div>
        {couponMsg && <p className="text-sm font-medium text-emerald-600">{couponMsg}</p>}
      </div>

      {/* Totals Summary */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>৳{baseAmount}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600 font-medium">
            <span>Discount ({appliedCoupon})</span>
            <span>-৳{discountAmount}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-100">
          <span>Total</span>
          <span>৳{finalAmount}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
          {error}
        </div>
      )}

      {/* Action */}
      <form onSubmit={handleCheckout}>
        <Button 
          type="submit" 
          className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md" 
          disabled={loading || validating}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            'Continue to Payment'
          )}
        </Button>
      </form>
    </div>
  )
}
