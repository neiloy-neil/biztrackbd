'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { changePlanAction, cancelSubscriptionAction, resumeSubscriptionAction } from '@/domains/billing/actions'
import { Loader2, Tag, AlertTriangle, CalendarClock } from 'lucide-react'

type PlanListProps = {
  plans: any[]
  activePlanId?: string
  activePlanPrice?: number
  scheduledPlanId?: string
  scheduledPlanName?: string
  cancelAtPeriodEnd?: boolean
  periodEnd?: string
}

export default function PlanList({ 
  plans, 
  activePlanId, 
  activePlanPrice = 0,
  scheduledPlanId, 
  scheduledPlanName, 
  cancelAtPeriodEnd, 
  periodEnd 
}: PlanListProps) {
  const router = useRouter()
  const [promoCode, setPromoCode] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(planId: string) {
    setLoadingId(planId)
    setError(null)
    const formData = new FormData()
    formData.append('plan_id', planId)
    if (promoCode) {
      formData.append('promo_code', promoCode)
    }

    try {
      await changePlanAction(formData)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoadingId(null)
    }
  }

  async function handleCancelToggle() {
    setIsCanceling(true)
    setError(null)
    try {
      if (cancelAtPeriodEnd) {
        await resumeSubscriptionAction()
      } else {
        await cancelSubscriptionAction()
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCanceling(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {cancelAtPeriodEnd && periodEnd && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-orange-800">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-semibold">Subscription Canceled</p>
              <p className="text-sm">Your subscription will remain active until {new Date(periodEnd).toLocaleDateString()}. You will not be charged again.</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleCancelToggle} disabled={isCanceling} className="bg-white text-orange-700 border-orange-300 hover:bg-orange-100">
            {isCanceling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Resume Subscription
          </Button>
        </div>
      )}

      {scheduledPlanId && scheduledPlanName && periodEnd && !cancelAtPeriodEnd && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-800">
          <CalendarClock className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-semibold">Scheduled Downgrade</p>
            <p className="text-sm">You are scheduled to downgrade to <strong>{scheduledPlanName}</strong> on {new Date(periodEnd).toLocaleDateString()}.</p>
          </div>
        </div>
      )}

      <div className="max-w-md bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-end gap-4">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Tag size={14} className="text-indigo-500" />
            Promo Code (Optional)
          </label>
          <Input 
            placeholder="Enter code here" 
            value={promoCode} 
            onChange={e => setPromoCode(e.target.value)}
            className="uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId
          const isScheduled = plan.id === scheduledPlanId
          const isLoading = loadingId === plan.id
          
          const isUpgrade = plan.price_monthly > activePlanPrice
          const buttonText = isActive ? 'সক্রিয় (Active)' : isScheduled ? 'Scheduled (পরবর্তী চক্র)' : isUpgrade ? 'আপগ্রেড (Upgrade)' : 'ডাউনগ্রেড (Downgrade)'

          return (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500' : isScheduled ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'} overflow-hidden flex flex-col relative`}>
              {isActive && (
                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  বর্তমান (Current)
                </div>
              )}
              {isScheduled && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Scheduled
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500 min-h-[40px] mb-4">{plan.description}</p>
                
                <div className="flex items-baseline text-3xl font-extrabold text-slate-900 mb-6">
                  ৳{plan.price_monthly}
                  <span className="ml-1 text-sm font-medium text-slate-500">/মাস (mo)</span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100">
                  <Button 
                    onClick={() => handleCheckout(plan.id)}
                    className="w-full" 
                    variant={isActive || isScheduled ? "outline" : isUpgrade ? "default" : "secondary"}
                    disabled={isActive || isScheduled || isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {buttonText}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!cancelAtPeriodEnd && (
        <div className="pt-8 text-center">
          <Button variant="ghost" onClick={handleCancelToggle} disabled={isCanceling} className="text-red-500 hover:text-red-700 hover:bg-red-50">
            {isCanceling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cancel Subscription
          </Button>
        </div>
      )}
    </div>
  )
}
