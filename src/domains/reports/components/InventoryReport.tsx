'use client'

import { useEffect, useState } from 'react'
import { getInventoryAnalytics } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import { format } from '@/lib/utils/date'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PackageOpen, AlertTriangle } from 'lucide-react'

export default function InventoryReport({ exportTrigger }: { exportTrigger: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getInventoryAnalytics(undefined as any)
      if (res.success) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (exportTrigger && data) {
      const exportData = data.stock_valuation_list.map((s: any) => ({
        Product_Name: s.name,
        Current_Stock: s.stock,
        Cost_Price: s.cost,
        Total_Value: s.value
      }))
      const filename = `Inventory_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`
      if (exportTrigger.format === 'csv') exportToCSV(exportData, filename)
      if (exportTrigger.format === 'excel') exportToExcel(exportData, filename)
      if (exportTrigger.format === 'pdf') exportToPDF(exportData, filename, 'Inventory Valuation Report')
    }
  }, [exportTrigger, data])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-100 rounded-xl w-full" /></div>
  if (!data) return <div className="text-center py-10 text-slate-500">No data available</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 text-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <PackageOpen className="w-4 h-4" /> Total Stock Valuation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">৳{data.total_valuation}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Stock Valuation List (Top 50)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Stock Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stock_valuation_list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">No stock available</TableCell>
                  </TableRow>
                )}
                {data.stock_valuation_list.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.stock}</TableCell>
                    <TableCell className="text-right">৳{s.cost}</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">৳{s.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-200">
          <CardHeader className="bg-amber-50 rounded-t-xl pb-4">
            <CardTitle className="text-amber-700 flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {data.low_stock_items.length === 0 && (
                <div className="text-center text-slate-500 py-4">No low stock items</div>
              )}
              {data.low_stock_items.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0">
                  <div className="font-medium text-slate-700 truncate mr-2">{s.name}</div>
                  <div className={`font-bold ${s.stock <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {s.stock} left
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
