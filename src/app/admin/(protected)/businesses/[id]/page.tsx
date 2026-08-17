import { fetchBusinessDetail } from '@/domains/admin/actions'
import { getEntitlements } from '@/domains/saas/entitlements'
import { notFound } from 'next/navigation'
import { 
  Building2, Users, MapPin, CreditCard, Activity, 
  ShieldAlert, Settings2, MoreVertical, 
  AlertTriangle, Power, PowerOff, Ban
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ActionsMenu } from './actions-menu'
import { ExtendTrialButton, GrantCreditButton } from './promo-actions'

export default async function BusinessDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const response = await fetchBusinessDetail({ businessId: id })
  const data = response.success ? response.data : null

  if (!data || !data.business) {
    notFound()
  }

  const { business, owner, metrics, subscription, usage_this_month, recent_audits } = data
  const entitlements = await getEntitlements(business.id)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
            <Badge variant={business.status === 'active' ? 'default' : 'destructive'}>
              {business.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1 font-mono">ID: {business.id}</p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 items-center">
          <ExtendTrialButton businessId={business.id} />
          <GrantCreditButton businessId={business.id} />
          <ActionsMenu businessId={business.id} status={business.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="h-3 w-3"/> Users</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.user_count}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="h-3 w-3"/> Branches</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.branch_count}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="h-3 w-3"/> Transactions</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.total_transactions}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Building2 className="h-3 w-3"/> Inventory</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.total_inventory}</div>
            </div>
          </div>

          {/* Subscription & Billing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-500" /> Subscription & SaaS Status
              </h3>
            </div>
            <div className="p-6">
              {subscription ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                      <div className="text-sm text-gray-500">Current Plan</div>
                      <div className="text-lg font-bold text-gray-900">{subscription.plan_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Status</div>
                      <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>{subscription.status}</Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                      <div className="text-sm text-gray-500">Period</div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(subscription.current_period_start).toLocaleDateString()} - {new Date(subscription.current_period_end).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">MRR</div>
                      <div className="text-sm font-bold text-gray-900">৳ {subscription.price_monthly}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Feature Usage (Current Period)</h4>
                    {entitlements && Object.keys(entitlements.features).length > 0 ? (
                      <div className="space-y-4">
                        {Object.keys(entitlements.features)
                          .filter(key => 
                            typeof entitlements.features[key] === 'object' && 
                            entitlements.features[key] !== null && 
                            entitlements.features[key].limit_value !== undefined
                          )
                          .map((key, idx: number) => {
                          const featureConfig = entitlements.features[key]
                          const usageCount = entitlements.usage[key] || 0
                          const limitValue = featureConfig.limit_value
                          const hardLimit = featureConfig.hard_limit_value || limitValue
                          const softLimitThreshold = featureConfig.soft_limit_threshold || 80
                          
                          const isUnlimited = limitValue === null
                          const percentage = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / limitValue) * 100))
                          
                          let statusColor = 'bg-emerald-500'
                          
                          if (!isUnlimited) {
                            if (percentage >= 100 && hardLimit && usageCount >= hardLimit) {
                              statusColor = 'bg-red-500'
                            } else if (percentage >= 100) {
                              statusColor = 'bg-orange-500'
                            } else if (percentage >= softLimitThreshold) {
                              statusColor = 'bg-yellow-400'
                            }
                          }

                          return (
                            <div key={idx}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="text-gray-900 font-semibold">{usageCount.toLocaleString()} / {isUnlimited ? '∞' : limitValue.toLocaleString()} {!isUnlimited && <span className="text-gray-500 font-normal ml-1">({percentage}%)</span>}</span>
                              </div>
                              {!isUnlimited && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div className={`${statusColor} h-1.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No feature usage recorded this period.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No active subscription found. They are likely on the free tier.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Owner Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Owner Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Phone Number</div>
                <div className="text-sm font-medium text-gray-900">{owner?.phone || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Internal Email</div>
                <div className="text-sm text-gray-600">{owner?.email || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">User ID</div>
                <div className="text-xs font-mono text-gray-500 break-all">{owner?.id || 'Unknown'}</div>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <h3 className="font-semibold text-gray-900">Platform Audit Log</h3>
            </div>
            <div className="p-0">
              {recent_audits && recent_audits.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {recent_audits.map((audit: any, idx: number) => (
                    <li key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{audit.action}</span>
                        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-2">
                        By: <span className="font-mono">{audit.user_email || 'System'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  No platform actions have been taken on this tenant.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
