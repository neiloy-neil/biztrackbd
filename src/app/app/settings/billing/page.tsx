import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, CreditCard, AlertTriangle, AlertCircle, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getEntitlements } from '@/domains/saas/entitlements'
import PlanList from './plan-list'

export default async function TenantBillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Get active business for the current user
  const { data: staffData } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    
  if (!staffData || staffData.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        You are not assigned to a business.
      </div>
    )
  }
  const businessId = staffData[0].business_id

  // 2. Fetch current entitlements
  const entitlements = await getEntitlements(businessId)

  // 3. Fetch all active plans
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true })

  if (!plans || plans.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        No plans are currently available. Please contact support.
      </div>
    )
  }

  // 4. Fetch subscription details
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('cancel_at_period_end, scheduled_plan_id, plans!subscriptions_scheduled_plan_id_fkey(name)')
    .eq('business_id', businessId)
    .single()

  const activePlanId = entitlements?.plan?.id
  const activePlanPrice = plans.find(p => p.id === activePlanId)?.price_monthly || 0

  // Feature labels mapping
  const featureLabels: Record<string, string> = {
    transactions_per_month: 'Transactions / Month',
    max_users: 'Users',
    max_branches: 'Branches',
    max_products: 'Products',
  }

  // Filter for metered features (those with limit objects)
  const meteredFeatures = entitlements?.features 
    ? Object.keys(entitlements.features).filter(k => 
        typeof entitlements.features[k] === 'object' && 
        entitlements.features[k] !== null && 
        (entitlements.features[k] as any).limit_value !== undefined &&
        (entitlements.features[k] as any).limit_value !== null && // Filter out unlimited if needed, or keep to show 0 / ∞
        featureLabels[k]
      ) 
    : []

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">সাবস্ক্রিপশন প্ল্যান (Subscription Plan)</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <h3 className="text-lg font-medium text-slate-800 mb-2">আপনার বর্তমান প্ল্যান (Your Current Plan)</h3>
        {entitlements ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-600">{entitlements.plan.name}</span>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">সক্রিয় (Active)</Badge>
                  <a href={`/app/settings/billing/invoices`} className="ml-4 text-sm text-indigo-600 hover:underline">View Invoices</a>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Reset Date: {new Date(entitlements.plan.period_end).toLocaleDateString('bn-BD')}
                </p>
              </div>
            </div>

            {/* Usage Overview Section */}
            {meteredFeatures.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-6">
                <h4 className="text-md font-semibold text-slate-800 mb-4">Usage Overview</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {meteredFeatures.map(key => {
                    const featureConfig = entitlements.features[key] as any
                    const usageCount = entitlements.usage[key] || 0
                    const limitValue = featureConfig?.limit_value
                    const hardLimit = featureConfig?.hard_limit_value || limitValue
                    const softLimitThreshold = featureConfig?.soft_limit_threshold || 80
                    
                    const isUnlimited = limitValue === null
                    const percentage = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / limitValue) * 100))
                    
                    let statusColor = 'bg-emerald-500'
                    let textColor = 'text-emerald-700'
                    let warningMessage = null
                    
                    if (!isUnlimited) {
                      if (percentage >= 100 && hardLimit && usageCount >= hardLimit) {
                        statusColor = 'bg-red-500'
                        textColor = 'text-red-700'
                        warningMessage = 'You have reached your hard limit. Further actions are blocked until you upgrade.'
                      } else if (percentage >= 100) {
                        statusColor = 'bg-orange-500'
                        textColor = 'text-orange-700'
                        warningMessage = 'You are in your grace period limits. Please upgrade soon.'
                      } else if (percentage >= softLimitThreshold) {
                        statusColor = 'bg-yellow-400'
                        textColor = 'text-yellow-700'
                        warningMessage = `You have used ${percentage}% of your limit.`
                      }
                    }

                    return (
                      <div key={key} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-end mb-2">
                          <span className="font-medium text-slate-700">{featureLabels[key]}</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {usageCount.toLocaleString()} / {isUnlimited ? '∞' : limitValue.toLocaleString()} 
                            {!isUnlimited && <span className="text-slate-500 font-normal ml-1">({percentage}%)</span>}
                          </span>
                        </div>
                        
                        {!isUnlimited && (
                          <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                            <div className={`h-2.5 rounded-full ${statusColor}`} style={{ width: `${percentage}%` }}></div>
                          </div>
                        )}
                        
                        {warningMessage && (
                          <div className={`flex items-start gap-2 mt-2 text-sm ${textColor}`}>
                            {percentage >= 100 ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                            <span>{warningMessage}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500">কোনো সক্রিয় প্ল্যান নেই। দয়া করে একটি প্ল্যান বেছে নিন। (No active plan. Please select a plan.)</div>
        )}
      </div>

      <PlanList 
        plans={plans} 
        activePlanId={activePlanId} 
        activePlanPrice={activePlanPrice}
        scheduledPlanId={subscription?.scheduled_plan_id}
        scheduledPlanName={Array.isArray(subscription?.plans) ? subscription?.plans[0]?.name : (subscription?.plans as any)?.name}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end}
        periodEnd={entitlements?.plan?.period_end}
      />
    </div>
  )
}
