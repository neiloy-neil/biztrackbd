'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { payRenewalAction } from '@/domains/billing/actions/checkout'

export function PayRenewalButton({ invoiceId }: { invoiceId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const res = await payRenewalAction(invoiceId)
      if (res.success && res.paymentUrl) {
        window.location.href = res.paymentUrl
      } else {
        setError(res.error || 'Payment initialization failed')
        setIsLoading(false)
      }
    } catch (e: any) {
      setError(e.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <Button 
        onClick={handlePay} 
        disabled={isLoading}
        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : null}
        Pay Now
        {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
