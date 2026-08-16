'use client'

import { useEffect, useState } from 'react'
import { getPartyDues } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import { format } from '@/lib/utils/date'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DueReport({ exportTrigger }: { exportTrigger: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const res = await getPartyDues(undefined as any)
      if (res.success) setData(res.data)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (exportTrigger && data) {
      // Export customer dues as default for now, could be split later
      const exportData = [
        ...data.customer_dues.map((c: any) => ({ Type: 'Customer Due', Name: c.name, Phone: c.phone, Balance: c.balance })),
        ...data.supplier_payables.map((s: any) => ({ Type: 'Supplier Payable', Name: s.name, Phone: s.phone, Balance: s.balance }))
      ]
      const filename = `Due_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`
      if (exportTrigger.format === 'csv') exportToCSV(exportData, filename)
      if (exportTrigger.format === 'excel') exportToExcel(exportData, filename)
      if (exportTrigger.format === 'pdf') exportToPDF(exportData, filename, 'Party Due Report')
    }
  }, [exportTrigger, data])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-100 rounded-xl w-full" /></div>
  if (!data) return <div className="text-center py-10 text-slate-500">No data available</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-emerald-600">Customer Dues (Receivable)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customer_dues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500">No outstanding dues</TableCell>
                </TableRow>
              )}
              {data.customer_dues.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || '-'}</TableCell>
                  <TableCell className="text-right font-bold text-slate-900">৳{c.balance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-600">Supplier Payables (Payable)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.supplier_payables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500">No outstanding payables</TableCell>
                </TableRow>
              )}
              {data.supplier_payables.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.phone || '-'}</TableCell>
                  <TableCell className="text-right font-bold text-slate-900">৳{s.balance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
