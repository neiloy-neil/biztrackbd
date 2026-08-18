'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingDown, TrendingUp, Package, Users, Activity, BellRing } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function InsightsDashboard({ insights }: { insights: any }) {
  const router = useRouter()

  const { low_stock, top_debtors, expense_spikes, top_selling } = insights

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 1. Low Stock Alerts */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Low Stock Alerts
          </CardTitle>
          <CardDescription>Items critically low on stock</CardDescription>
        </CardHeader>
        <CardContent>
          {low_stock?.length > 0 ? (
            <ul className="space-y-4">
              {low_stock.map((item: any) => (
                <li key={item.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="text-sm text-slate-500">
                      Stock: <span className="font-bold text-red-600">{item.current_stock}</span> (Min: {item.min_stock})
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/app/inventory`)}>
                    Restock
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">All stock levels look healthy!</p>
          )}
        </CardContent>
      </Card>

      {/* 2. Top Debtors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Top Outstanding Debtors
          </CardTitle>
          <CardDescription>Customers with the highest dues</CardDescription>
        </CardHeader>
        <CardContent>
          {top_debtors?.length > 0 ? (
            <ul className="space-y-4">
              {top_debtors.map((debtor: any) => (
                <li key={debtor.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{debtor.name}</span>
                    <span className="text-sm text-slate-500">{debtor.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600">৳ {Number(debtor.current_due).toLocaleString()}</span>
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/app/parties/${debtor.id}`)}>
                      <BellRing className="h-4 w-4 mr-2" /> Remind
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No customers owe you money!</p>
          )}
        </CardContent>
      </Card>

      {/* 3. Expense Spikes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Expense Monitor
          </CardTitle>
          <CardDescription>This Week vs Last Week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-3xl font-bold text-slate-900">
              ৳ {Number(expense_spikes?.this_week || 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 mb-4">Total expenses this week</div>
            
            {expense_spikes?.spike_percentage > 0 ? (
              <Badge variant="destructive" className="px-3 py-1 flex items-center gap-1 text-sm">
                <TrendingUp className="h-4 w-4" /> 
                {expense_spikes.spike_percentage}% increase from last week
              </Badge>
            ) : expense_spikes?.spike_percentage < 0 ? (
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 flex items-center gap-1 text-sm">
                <TrendingDown className="h-4 w-4" /> 
                {Math.abs(expense_spikes.spike_percentage)}% decrease from last week
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-3 py-1 flex items-center gap-1 text-sm">
                Same as last week
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Top Selling Products */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Top Selling (Last 30 Days)
          </CardTitle>
          <CardDescription>Products moving the fastest</CardDescription>
        </CardHeader>
        <CardContent>
          {top_selling?.length > 0 ? (
            <ul className="space-y-4">
              {top_selling.map((item: any, idx: number) => (
                <li key={item.product_id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    #{idx + 1}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                  <span className="font-bold text-emerald-600">{Number(item.total_sold).toLocaleString()} sold</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Not enough sales data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
