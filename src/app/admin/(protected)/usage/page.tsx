import { BarChart3, TrendingDown, Server, DollarSign, AlertTriangle } from 'lucide-react'
import { getPlatformUsageStats, getPlanProfitability, getHighBurnCustomers } from '@/domains/admin/analytics-actions'
import { Badge } from '@/components/ui/badge'

export default async function AdminUsagePage() {
  const [statsRes, planRes, burnRes] = await Promise.all([
    getPlatformUsageStats(),
    getPlanProfitability(),
    getHighBurnCustomers()
  ])

  if (!statsRes.success || !planRes.success || !burnRes.success) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-lg border border-red-200">
        Failed to load usage analytics. Please check your permissions or database views.
      </div>
    )
  }

  const stats = statsRes.data!
  const plans = planRes.data!
  const highBurn = burnRes.data!

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Server className="h-6 w-6 text-indigo-600" />
          Platform Usage & Cost Intelligence
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor infrastructure costs versus subscription revenue to ensure platform profitability.
        </p>
      </div>

      {/* Platform Level Metrics */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          Platform Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase">Active Businesses</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.active_businesses}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase">Total MRR</div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">৳{stats.total_mrr.toFixed(2)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase">Estimated Usage Cost</div>
            <div className="mt-2 text-3xl font-bold text-rose-600">৳{stats.total_cost.toFixed(2)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase">Gross Margin (Est)</div>
            <div className={`mt-2 text-3xl font-bold ${stats.gross_margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ৳{stats.gross_margin.toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* Plan Level Profitability */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-gray-400" />
          Plan Profitability
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Active Subs</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total MRR</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((plan) => (
                <tr key={plan.plan_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.plan_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{plan.active_subscriptions}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-600">৳{plan.total_mrr.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-rose-600">৳{plan.total_cost.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Badge variant={plan.margin >= 0 ? "secondary" : "destructive"}>
                      ৳{plan.margin.toFixed(2)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* High Burn Customers */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 text-rose-600">
          <AlertTriangle className="h-5 w-5" />
          High-Burn Customers (Cost {'>'} 80% MRR)
        </h2>
        {highBurn.length === 0 ? (
          <div className="bg-emerald-50 text-emerald-700 p-6 rounded-lg border border-emerald-200">
            All customers are currently operating within healthy profitability margins.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SMS / AI</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MRR</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-rose-600 uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {highBurn.map((b) => (
                  <tr key={b.business_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{b.business_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {b.plan_name || 'Free'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{b.total_transactions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {b.total_sms || 0} / {b.total_ai_requests || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-600">৳{(b.mrr || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-rose-600 font-bold">
                      ৳{b.estimated_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
