import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import ReportsClient from '@/domains/reports/components/ReportsClient'
import { FileBarChart2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileBarChart2 className="w-8 h-8 text-blue-600" />
            Reporting System
          </h1>
          <p className="text-slate-500 mt-1">
            Comprehensive analytics and insights for your business
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading reports...</div>}>
            <ReportsClient />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
