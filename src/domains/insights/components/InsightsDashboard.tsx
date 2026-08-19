'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingDown, TrendingUp, Package, Users, Activity, BellRing } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function InsightsDashboard({ insights, healthScore }: { insights: any, healthScore?: any }) {
  const router = useRouter()

  const { low_stock, top_debtors, expense_spikes, top_selling } = insights

  return (
    <div className="space-y-6">
      {/* 0. Business Health Score Hero */}
      {healthScore && (
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Activity className="w-48 h-48 text-indigo-900" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-indigo-900 flex items-center gap-2">
              <Activity className="h-6 w-6 text-indigo-600" />
              Business Health Score
            </CardTitle>
            <CardDescription className="text-indigo-700/70">
              A comprehensive score based on your cash flow, receivables, and profitability this month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8 py-4">
              {/* Score Circle */}
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    className="text-indigo-100"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="58"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className={`transition-all duration-1000 ease-out ${
                      healthScore.total_score >= 80 ? 'text-emerald-500' :
                      healthScore.total_score >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}
                    strokeWidth="8"
                    strokeDasharray={364}
                    strokeDashoffset={364 - (364 * healthScore.total_score) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="58"
                    cx="64"
                    cy="64"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-4xl font-bold text-slate-900">{healthScore.total_score}</span>
                  <span className="text-xs text-slate-500 font-medium">/ 100</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="bg-white/60 p-4 rounded-xl border border-indigo-50/50">
                  <div className="text-sm font-medium text-slate-500 mb-1">Cash Flow</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-900">{healthScore.cash_flow.score}</span>
                    <span className="text-sm text-slate-400 mb-1">/ {healthScore.cash_flow.max}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Net: ৳{Number(healthScore.cash_flow.net).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-indigo-50/50">
                  <div className="text-sm font-medium text-slate-500 mb-1">Receivables</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-900">{healthScore.receivables.score}</span>
                    <span className="text-sm text-slate-400 mb-1">/ {healthScore.receivables.max}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Due: ৳{Number(healthScore.receivables.due).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-indigo-50/50">
                  <div className="text-sm font-medium text-slate-500 mb-1">Profitability</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-900">{healthScore.profitability.score}</span>
                    <span className="text-sm text-slate-400 mb-1">/ {healthScore.profitability.max}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Margin: {(Number(healthScore.profitability.margin) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}
