import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, Wallet, Users, Truck, TrendingUp } from 'lucide-react'
import { formatBanglaCurrency } from '@/lib/utils/bangla'
import { getDashboardSummary } from '../actions'

export async function DashboardMetrics({ startDate, endDate }: { startDate: string, endDate: string }) {
  const res = await getDashboardSummary({ startDate, endDate })

  if (!res?.success || !res.data) {
    const errMsg = res && !res.success ? res.error : 'Unknown error'
    return (
      <div className="p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-200">
        Error loading metrics: {errMsg}
      </div>
    )
  }

  const {
    total_sales,
    total_cogs,
    gross_profit,
    total_expenses,
    net_profit,
    available_money,
    customer_due,
    supplier_due,
  } = res.data as any

  return (
    <>
      {/* Row 1: Sales, COGS, Gross Profit, Net Profit */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Sales */}
        <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-emerald-800">বিক্রি</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight">৳ {formatBanglaCurrency(total_sales)}</div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border-rose-100 bg-rose-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-rose-800">খরচ</CardTitle>
            <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-rose-700 tracking-tight">৳ {formatBanglaCurrency(total_expenses)}</div>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className="border-teal-100 bg-teal-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-teal-800">গ্রস লাভ</CardTitle>
            <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-teal-700 tracking-tight">৳ {formatBanglaCurrency(gross_profit)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">বিক্রি − পণ্য ক্রয়মূল্য</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-blue-100 bg-blue-50/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-blue-800">নেট লাভ</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">৳ {formatBanglaCurrency(net_profit)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">গ্রস লাভ + অন্য আয় − খরচ</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Available Money, Customer Due, Supplier Due */}
      <div className="grid gap-4 grid-cols-3 mt-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700">অ্যাভেইলেবল টাকা</CardTitle>
            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
              <Wallet className="h-3.5 w-3.5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-900 tracking-tight">৳ {formatBanglaCurrency(available_money)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">ক্যাশ ও ব্যাংক</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-amber-800">পাওনা</CardTitle>
            <Users className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-amber-700">৳ {formatBanglaCurrency(customer_due)}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-orange-800">দেনা</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-700">৳ {formatBanglaCurrency(supplier_due)}</div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function DashboardMetricsSkeleton() {
  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-slate-100 bg-slate-50">
            <CardHeader className="pb-2">
              <div className="h-4 bg-slate-200 rounded w-16" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-slate-200 rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-3 mt-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-slate-100 bg-slate-50">
            <CardHeader className="pb-2">
              <div className="h-3 bg-slate-200 rounded w-12" />
            </CardHeader>
            <CardContent>
              <div className="h-6 bg-slate-200 rounded w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
