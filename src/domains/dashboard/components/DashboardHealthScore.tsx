import { getBusinessHealthScore } from '../actions'
import { BusinessHealthScore } from './BusinessHealthScore'

export async function DashboardHealthScore({ startDate, endDate }: { startDate: string, endDate: string }) {
  const res = await getBusinessHealthScore({ startDate, endDate })

  if (!res?.success || !res.data) {
    return null
  }

  return <BusinessHealthScore data={res.data} />
}
