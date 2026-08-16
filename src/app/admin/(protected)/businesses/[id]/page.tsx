import { fetchBusinessDetail } from '@/domains/admin/actions'
import { notFound } from 'next/navigation'
import { 
  Building2, Users, MapPin, CreditCard, Activity, 
  ShieldAlert, Settings2, MoreVertical, 
  AlertTriangle, Power, PowerOff, Ban
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ActionsMenu } from './actions-menu'

export default async function BusinessDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchBusinessDetail(id)

  if (!data || !data.business) {
    notFound()
  }

  const { business, owner, metrics, subscription, usage_this_month, recent_audits } = data

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
        
        {/* Dangerous Actions Menu */}
        <ActionsMenu businessId={business.id} status={business.status} />
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
                    {usage_this_month && usage_this_month.length > 0 ? (
                      <div className="space-y-3">
                        {usage_this_month.map((usage: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-gray-700 capitalize">{usage.feature_key}</span>
                              <span className="text-gray-500">{usage.usage_count} units</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              {/* Fake progress bar since we don't have limits fetched here yet */}
                              <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                            </div>
                          </div>
                        ))}
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
