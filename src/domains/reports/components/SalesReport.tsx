'use client'

import { useEffect, useState } from 'react'
import { getSalesAnalytics } from '../actions'
import { DateRange } from './ReportsClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import { format } from '@/lib/utils/date'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function SalesReport({ dateRange, exportTrigger }: { dateRange: DateRange, exportTrigger: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getSalesAnalytics({ startDate: format(dateRange.startDate, 'yyyy-MM-dd'), endDate: format(dateRange.endDate, 'yyyy-MM-dd') })
      if (res.success) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [dateRange])

  useEffect(() => {
    if (exportTrigger && data) {
      // Exporting the sales_by_product as default CSV
      const exportData = data.sales_by_product.map((p: any) => ({
        Product_Name: p.product_name,
        Quantity_Sold: p.qty,
        Revenue: p.revenue
      }))
      const filename = `Sales_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`
      if (exportTrigger.format === 'csv') exportToCSV(exportData, filename)
      if (exportTrigger.format === 'excel') exportToExcel(exportData, filename)
      if (exportTrigger.format === 'pdf') exportToPDF(exportData, filename, `Sales by Product (${dateRange.label})`)
    }
  }, [exportTrigger, data])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-100 rounded-xl w-full" /></div>
  if (!data) return <div className="text-center py-10 text-slate-500">No data available</div>

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sales_by_day} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM dd')} stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <RechartsTooltip formatter={(value) => [`৳${value}`, 'Revenue']} labelFormatter={(label: string) => format(new Date(label), 'MMM dd, yyyy')} />
                <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.sales_by_product.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="font-medium text-slate-700 truncate mr-4">{item.product_name}</div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-500 mr-4">{item.qty} sold</span>
                    <span className="font-bold text-slate-900 w-20 inline-block">৳{item.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sales by Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sales_by_payment}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="account"
                    label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {data.sales_by_payment.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`৳${value}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
