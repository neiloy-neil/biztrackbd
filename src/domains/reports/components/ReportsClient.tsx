'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReportFilters from './ReportFilters'
import FinancialReport from './FinancialReport'
import SalesReport from './SalesReport'
import ExpenseReport from './ExpenseReport'
import DueReport from './DueReport'
import InventoryReport from './InventoryReport'
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { format } from '@/lib/utils/date'

export type DateRange = {
  startDate: Date
  endDate: Date
  label: string
}

const presetRanges = {
  today: { startDate: startOfDay(new Date()), endDate: endOfDay(new Date()), label: 'Today' },
  yesterday: { startDate: startOfDay(subDays(new Date(), 1)), endDate: endOfDay(subDays(new Date(), 1)), label: 'Yesterday' },
  thisWeek: { startDate: startOfWeek(new Date()), endDate: endOfWeek(new Date()), label: 'This Week' },
  thisMonth: { startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()), label: 'This Month' },
  lastMonth: { startDate: startOfMonth(subMonths(new Date(), 1)), endDate: endOfMonth(subMonths(new Date(), 1)), label: 'Last Month' }
}

export default function ReportsClient() {
  const [dateRange, setDateRange] = useState<DateRange>(presetRanges.thisMonth)
  const [activeTab, setActiveTab] = useState('financial')
  const [exportTrigger, setExportTrigger] = useState<{ format: 'csv' | 'excel' | 'pdf', timestamp: number } | null>(null)

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    setExportTrigger({ format, timestamp: Date.now() })
  }

  return (
    <div className="flex flex-col w-full">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="flex flex-wrap h-auto w-full md:w-auto justify-start gap-1 p-1">
            <TabsTrigger value="financial" className="flex-1 md:flex-none">Financial</TabsTrigger>
            <TabsTrigger value="sales" className="flex-1 md:flex-none">Sales</TabsTrigger>
            <TabsTrigger value="expense" className="flex-1 md:flex-none">Expense</TabsTrigger>
            <TabsTrigger value="due" className="flex-1 md:flex-none">Due</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 md:flex-none">Inventory</TabsTrigger>
          </TabsList>
        </Tabs>

        <ReportFilters 
          currentRange={dateRange} 
          onRangeChange={setDateRange} 
          onExport={handleExport}
          hideDates={activeTab === 'due' || activeTab === 'inventory'}
        />
      </div>

      <div className="p-4 md:p-6 min-h-[500px]">
        {activeTab === 'financial' && <FinancialReport dateRange={dateRange} exportTrigger={exportTrigger} />}
        {activeTab === 'sales' && <SalesReport dateRange={dateRange} exportTrigger={exportTrigger} />}
        {activeTab === 'expense' && <ExpenseReport dateRange={dateRange} exportTrigger={exportTrigger} />}
        {activeTab === 'due' && <DueReport exportTrigger={exportTrigger} />}
        {activeTab === 'inventory' && <InventoryReport exportTrigger={exportTrigger} />}
      </div>
    </div>
  )
}
