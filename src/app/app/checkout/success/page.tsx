'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCheckoutSessionStatus } from '@/domains/billing/actions/checkout'
import { CheckCircle2, Loader2, ArrowRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [status, setStatus] = useState<'loading' | 'paid' | 'failed' | 'cancelled' | 'expired'>('loading')
  const [data, setData] = useState<{ planName?: string, periodEnd?: string, businessId?: string, businessName?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session')
      setStatus('failed')
      return
    }

    let isMounted = true
    let pollInterval: NodeJS.Timeout

    const checkStatus = async () => {
      try {
        const res = await getCheckoutSessionStatus(sessionId)
        if (!isMounted) return

        if (!res.success) {
          setError(res.error || 'Failed to verify session')
          setStatus('failed')
          return
        }

        if (res.status === 'paid') {
          setData({
            planName: res.planName,
            periodEnd: res.periodEnd,
            businessId: res.businessId,
            businessName: res.businessName
          })
          setStatus('paid')
        } else if (res.status === 'failed') {
          setError('Your payment provider rejected the transaction.')
          setStatus('failed')
        } else if (res.status === 'cancelled') {
          setError('You cancelled the payment process.')
          setStatus('cancelled')
        } else if (res.status === 'expired') {
          setError('This checkout session has expired.')
          setStatus('expired')
        }
        // If pending/payment_started, keep polling
      } catch (err: any) {
        if (isMounted) {
          setError(err.message)
          setStatus('failed')
        }
      }
    }

    // Initial check
    checkStatus()

    // Poll every 3 seconds if not resolved
    if (status === 'loading') {
      pollInterval = setInterval(checkStatus, 3000)
    }

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [sessionId, status])

  const handleContinue = () => {
    if (data?.businessName && data.businessName !== 'My Business') {
      router.push('/app/dashboard')
    } else {
      router.push('/app/onboarding')
    }
  }

  const handleRetry = () => {
    router.push('/app/checkout')
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Payment failed</h1>
          <p className="text-slate-500">{error}</p>
          <Button onClick={handleRetry} className="w-full" variant="default">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-100 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Payment cancelled</h1>
          <p className="text-slate-500">{error}</p>
          <Button onClick={handleRetry} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Checkout expired</h1>
          <p className="text-slate-500">{error}</p>
          <Button onClick={handleRetry} className="w-full bg-slate-800 hover:bg-slate-900 text-white">
            Create new checkout
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md w-full">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Payment is being verified</h1>
          <p className="text-slate-500">Please wait while we securely confirm your transaction with the provider. This usually takes a few seconds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-indigo-100/20 border border-slate-100 max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Payment Successful!</h1>
          <p className="text-slate-500 text-lg">Your subscription has been activated.</p>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
          <div className="flex justify-between items-center pb-4 border-b border-slate-200">
            <span className="text-slate-500">Plan</span>
            <span className="font-semibold text-slate-900">{data?.planName}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-slate-200">
            <span className="text-slate-500">Status</span>
            <span className="font-semibold text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Active
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Next Renewal</span>
            <span className="font-medium text-slate-900">
              {data?.periodEnd ? new Date(data.periodEnd).toLocaleDateString() : 'Pending'}
            </span>
          </div>
        </div>

        <Button 
          onClick={handleContinue} 
          size="lg" 
          className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 group"
        >
          Continue to BizTrack
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
