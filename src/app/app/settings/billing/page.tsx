import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Check, CreditCard, Building } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { startCheckoutAction } from '@/domains/billing/actions'
import { getEntitlements } from '@/domains/saas/entitlements'

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

  const activePlanId = entitlements?.plan?.id

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">সাবস্ক্রিপশন প্ল্যান (Subscription Plan)</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <h3 className="text-lg font-medium text-slate-800 mb-2">আপনার বর্তমান প্ল্যান (Your Current Plan)</h3>
        {entitlements ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-indigo-600">{entitlements.plan.name}</span>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">সক্রিয় (Active)</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                মেয়াদ শেষ: {new Date(entitlements.plan.period_end).toLocaleDateString('bn-BD')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">SMS Usage</div>
              <div className="font-medium text-slate-900">{entitlements.usage.transactions_per_month || 0} / {entitlements.features.transactions_per_month === null ? '∞' : entitlements.features.transactions_per_month}</div>
            </div>
          </div>
        ) : (
          <div className="text-slate-500">কোনো সক্রিয় প্ল্যান নেই। দয়া করে একটি প্ল্যান বেছে নিন। (No active plan. Please select a plan.)</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId

          return (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'} overflow-hidden flex flex-col relative`}>
              {isActive && (
                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  বর্তমান (Current)
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
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      variant={isActive ? "outline" : "default"}
                      disabled={isActive}
                    >
                      {isActive ? 'সক্রিয় (Active)' : 'আপগ্রেড করুন (Upgrade)'}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
