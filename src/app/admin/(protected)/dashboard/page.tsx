import { getPlatformMetrics, getPlatformGrowth } from '@/domains/admin/actions'
import { PlatformMetricsGrid } from '@/domains/admin/components/PlatformMetricsGrid'
import { PlatformCharts } from '@/domains/admin/components/PlatformCharts'
import { QuickActions } from '@/domains/admin/components/QuickActions'

export const metadata = {
  title: 'Platform Control Plane | BizTrack Admin',
}

export default async function SuperAdminDashboard() {
  // Fetch platform metrics concurrently
  const [metricsResponse, growthResponse] = await Promise.all([
    getPlatformMetrics(),
    getPlatformGrowth()
  ])

  const metrics = metricsResponse.success ? metricsResponse.data : null
  const growthData = growthResponse.success ? growthResponse.data : null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 mt-1">High-level metrics across all BizTrack tenants.</p>
      </div>

      {(!metricsRes.success || !growthRes.success) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          Warning: Failed to load some platform metrics. Please check system logs.
        </div>
      )}

      {/* Primary Metrics Grid */}
      <PlatformMetricsGrid metrics={metrics} />

      {/* Visualizations */}
      <PlatformCharts growthData={growthData} />

      {/* Shortcuts */}
      <QuickActions />
    </div>
  )
}
