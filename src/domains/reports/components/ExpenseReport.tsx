'use client'

import { useEffect, useState } from 'react'
import { getExpenseAnalytics } from '../actions'
import { DateRange } from './ReportsClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import { format } from '@/lib/utils/date'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#6366f1', '#a855f7']

export default function ExpenseReport({ dateRange, exportTrigger }: { dateRange: DateRange, exportTrigger: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getExpenseAnalytics({ startDate: format(dateRange.startDate, 'yyyy-MM-dd'), endDate: format(dateRange.endDate, 'yyyy-MM-dd') })
      if (res.success) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [dateRange])

  useEffect(() => {
    if (exportTrigger && data) {
      const exportData = data.expense_by_category.map((c: any) => ({
        Category: c.category,
        Amount: c.total
      }))
      const filename = `Expense_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`
      if (exportTrigger.format === 'csv') exportToCSV(exportData, filename)
      if (exportTrigger.format === 'excel') exportToExcel(exportData, filename)
      if (exportTrigger.format === 'pdf') exportToPDF(exportData, filename, `Expense by Category (${dateRange.label})`)
    }
  }, [exportTrigger, data])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-100 rounded-xl w-full" /></div>
  if (!data) return <div className="text-center py-10 text-slate-500">No data available</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Expense by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.expense_by_category}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="total"
                  nameKey="category"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {data.expense_by_category.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => [`৳${value}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Expense Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expense_trend} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM dd')} stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <RechartsTooltip formatter={(value) => [`৳${value}`, 'Expense']} labelFormatter={(label) => format(new Date(String(label)), 'MMM dd, yyyy')} />
                <Bar dataKey="total" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
