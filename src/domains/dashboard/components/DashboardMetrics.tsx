import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, Wallet, Users, Truck } from 'lucide-react'
import { formatBanglaCurrency } from '@/lib/utils/bangla'
import { getDashboardSummary } from '../actions'

export async function DashboardMetrics({ startDate, endDate }: { startDate: string, endDate: string }) {
  const res = await getDashboardSummary({ startDate, endDate })

  if (!res?.success || !res.data) {
    return (
      <div className="p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-200">
        Error loading metrics: {res?.error || 'Unknown error'}
      </div>
    )
  }

  const { total_sales, total_expenses, estimated_profit, available_money, customer_due, supplier_payable } = res.data as any

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Sales */}
        <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-emerald-800">বিক্রি</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-emerald-700 tracking-tight">৳ {formatBanglaCurrency(total_sales)}</div>
          </CardContent>
        </Card>
        
        {/* Expenses */}
        <Card className="border-rose-100 bg-rose-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-rose-800">খরচ</CardTitle>
            <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-rose-700 tracking-tight">৳ {formatBanglaCurrency(total_expenses)}</div>
          </CardContent>
        </Card>

        {/* Profit */}
        <Card className="border-blue-100 bg-blue-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-blue-800">লাভ (আনুমানিক)</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-blue-700 tracking-tight">৳ {formatBanglaCurrency(estimated_profit)}</div>
          </CardContent>
        </Card>

        {/* Cash/Bank */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">অ্যাভেইলেবল টাকা</CardTitle>
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">৳ {formatBanglaCurrency(available_money)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">ক্যাশ ও ব্যাংক ব্যালেন্স</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-2 mt-4">
        {/* Customer Due */}
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-amber-800">পাওনা</CardTitle>
            <Users className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-700">৳ {formatBanglaCurrency(customer_due)}</div>
          </CardContent>
        </Card>

        {/* Supplier Payable */}
        <Card className="border-orange-200 bg-orange-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-orange-800">দেনা</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-700">৳ {formatBanglaCurrency(supplier_payable)}</div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function DashboardMetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="border-slate-100 bg-slate-50">
          <CardHeader className="pb-2">
            <div className="h-4 bg-slate-200 rounded w-16"></div>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-slate-200 rounded w-24"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
