import { CreditCard, Check, X, Building } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'

export default async function AdminBillingPage() {
  const supabase = await createClient()

  // Fetch all plans
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .order('price_monthly', { ascending: true })

  // Fetch all features for these plans
  const { data: features } = await supabase
    .from('plan_features')
    .select('*')

  // Fetch active subscriptions count per plan
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('status', 'active')

  const activeSubCounts = (subs || []).reduce((acc: Record<string, number>, sub) => {
    acc[sub.plan_id] = (acc[sub.plan_id] || 0) + 1
    return acc
  }, {})

  if (!plans || plans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Plans Found</h2>
          <p className="text-gray-500">Please run the entitlement engine SQL migration to seed the default plans.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" />
            Billing & Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage global subscription plans and view platform revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {plans.map((plan) => {
          const planFeatures = features?.filter(f => f.plan_id === plan.id) || []
          
          const getLimit = (key: string) => {
            const f = planFeatures.find(pf => pf.feature_key === key)
            return f ? f.limit_value : 0
          }

          const formatLimit = (key: string) => {
            const val = getLimit(key)
            if (val === null) return 'Unlimited'
            if (val === 0) return 'None'
            return val
          }

          const hasFeature = (key: string) => {
            const val = getLimit(key)
            return val === null || val > 0
          }

          return (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border ${!plan.is_active ? 'border-dashed border-gray-300 opacity-70' : 'border-gray-200'} overflow-hidden flex flex-col`}>
              <div className="p-6 border-b border-gray-100 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-sm text-gray-500 min-h-[40px]">{plan.description}</p>
                
                <div className="mt-4 flex items-baseline text-3xl font-extrabold text-gray-900">
                  ৳{plan.price_monthly}
                  <span className="ml-1 text-sm font-medium text-gray-500">/mo</span>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="text-sm font-medium text-gray-900 uppercase tracking-wider text-xs mb-2">Limits</div>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex justify-between"><span>Users</span> <span className="font-semibold">{formatLimit('max_users')}</span></li>
                    <li className="flex justify-between"><span>Branches</span> <span className="font-semibold">{formatLimit('max_branches')}</span></li>
                    <li className="flex justify-between"><span>Products</span> <span className="font-semibold">{formatLimit('max_products')}</span></li>
                    <li className="flex justify-between"><span>Transactions/mo</span> <span className="font-semibold">{formatLimit('transactions_per_month')}</span></li>
                  </ul>

                  <div className="text-sm font-medium text-gray-900 uppercase tracking-wider text-xs mt-6 mb-2">Features</div>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      {hasFeature('inventory') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('inventory') ? 'text-gray-400 line-through' : ''}>Inventory</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('pos') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('pos') ? 'text-gray-400 line-through' : ''}>Point of Sale</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('reports') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('reports') ? 'text-gray-400 line-through' : ''}>Reports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('staff_management') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('staff_management') ? 'text-gray-400 line-through' : ''}>Staff Management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('multi_branch') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('multi_branch') ? 'text-gray-400 line-through' : ''}>Multi-Branch</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('ai_features') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('ai_features') ? 'text-gray-400 line-through' : ''}>AI Insights</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {hasFeature('api_access') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                      <span className={!hasFeature('api_access') ? 'text-gray-400 line-through' : ''}>API Access</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                  <Building className="h-4 w-4 text-gray-400" />
                  {activeSubCounts[plan.id] || 0} active
                </div>
                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
