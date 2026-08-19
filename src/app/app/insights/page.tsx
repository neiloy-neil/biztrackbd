import { getInsightsData, getBusinessHealthScore } from '@/domains/insights/actions'
import { InsightsDashboard } from '@/domains/insights/components/InsightsDashboard'
import { AlertCircle } from 'lucide-react'

export const metadata = {
  title: 'Business Insights - BizTrack BD',
  description: 'Actionable intelligence for your business',
}

export default async function InsightsPage() {
  const result = await getInsightsData()

  // Get current month date range
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const healthResult = await getBusinessHealthScore({ startDate, endDate })

  if (!result.success || !healthResult.success) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-4 border border-red-200 text-red-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{(!result.success && result.error) || (!healthResult.success && healthResult.error) || 'Failed to load business insights.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Actionable Insights</h1>
        <p className="text-slate-500 mt-2">Data-driven recommendations to improve your business.</p>
      </div>

      <InsightsDashboard insights={result.data} healthScore={healthResult.data} />
    </div>
  )
}
