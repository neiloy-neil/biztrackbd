import { getTrendData } from '../actions'
import { TrendChart } from './TrendChart'

export async function DashboardTrend({ startDate, endDate }: { startDate: string, endDate: string }) {
  const res = await getTrendData({ startDate, endDate })

  if (!res?.success || !res.data) {
    return null
  }

  return <TrendChart data={res.data as any[]} />
}
