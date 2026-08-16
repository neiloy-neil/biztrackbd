import { Suspense } from 'react'
import { DateRangeFilter } from '@/domains/dashboard/components/DateRangeFilter'
import { QuickActions } from '@/domains/dashboard/components/QuickActions'
import { DashboardMetrics, DashboardMetricsSkeleton } from '@/domains/dashboard/components/DashboardMetrics'
import { DashboardTrend } from '@/domains/dashboard/components/DashboardTrend'
import { RecentTransactions } from '@/domains/dashboard/components/RecentTransactions'
import { LowStockProducts } from '@/domains/dashboard/components/LowStockProducts'

function getDateRange(range: string) {
  const today = new Date()
  let start = new Date()
  let end = new Date()

  switch (range) {
    case 'yesterday':
      start.setDate(today.getDate() - 1)
      end.setDate(today.getDate() - 1)
      break
    case 'this_week':
      start.setDate(today.getDate() - today.getDay())
      break
    case 'this_month':
      start.setDate(1)
      break
    case 'today':
    default:
      break
  }

  // Format to YYYY-MM-DD
  const format = (d: Date) => d.toISOString().split('T')[0]
  return { startDate: format(start), endDate: format(end) }
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Await the searchParams promise (Next.js 15+ requirement if dealing with async searchParams, but usually standard in 14+ for dynamic rendering)
  const resolvedSearchParams = await searchParams
  const range = (resolvedSearchParams?.range as string) || 'today'
  
  const { startDate, endDate } = getDateRange(range)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">ড্যাশবোর্ড</h2>
        <DateRangeFilter />
      </div>
      
      <QuickActions />

      <Suspense fallback={<DashboardMetricsSkeleton />}>
        <DashboardMetrics startDate={startDate} endDate={endDate} />
      </Suspense>

      <Suspense fallback={<div className="h-[250px] w-full bg-slate-100 animate-pulse rounded-xl mt-6"></div>}>
        <DashboardTrend startDate={startDate} endDate={endDate} />
      </Suspense>

      <div className="grid md:grid-cols-2 gap-6">
        <Suspense fallback={<div className="h-[200px] w-full bg-slate-100 animate-pulse rounded-xl mt-6"></div>}>
          <RecentTransactions />
        </Suspense>

        <Suspense fallback={<div className="h-[200px] w-full bg-slate-100 animate-pulse rounded-xl mt-6"></div>}>
          <LowStockProducts />
        </Suspense>
      </div>
    </div>
  )
}
