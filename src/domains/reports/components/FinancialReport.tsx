'use client'

import { useEffect, useState } from 'react'
import { getFinancialSummary } from '../actions'
import { DateRange } from './ReportsClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, DollarSign, Wallet } from 'lucide-react'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import { format } from '@/lib/utils/date'

export default function FinancialReport({ dateRange, exportTrigger }: { dateRange: DateRange, exportTrigger: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getFinancialSummary({ startDate: format(dateRange.startDate, 'yyyy-MM-dd'), endDate: format(dateRange.endDate, 'yyyy-MM-dd') })
      if (res.success) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [dateRange])

  useEffect(() => {
    if (exportTrigger && data) {
      const exportData = [{
        Total_Income: data.total_income,
        Total_Expense: data.total_expense,
        Net_Profit: data.net_profit,
        Cash_In: data.cash_in,
        Cash_Out: data.cash_out
      }]
      const filename = `Financial_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`
      if (exportTrigger.format === 'csv') exportToCSV(exportData, filename)
      if (exportTrigger.format === 'excel') exportToExcel(exportData, filename)
      if (exportTrigger.format === 'pdf') exportToPDF(exportData, filename, `Financial Summary (${dateRange.label})`)
    }
  }, [exportTrigger, data])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-slate-100 rounded-xl w-full" /></div>
  if (!data) return <div className="text-center py-10 text-slate-500">No data available</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-emerald-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">৳{data.total_income}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-rose-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4" /> Total Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">৳{data.total_expense}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">৳{data.net_profit}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Cash Inflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{data.cash_in}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Cash Outflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">৳{data.cash_out}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
