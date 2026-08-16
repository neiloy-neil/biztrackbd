'use client'

import { useState } from 'react'
import { DateRange } from './ReportsClient'
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { format } from '@/lib/utils/date'
import { Calendar as CalendarIcon, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

export const presetRanges = {
  today: { startDate: startOfDay(new Date()), endDate: endOfDay(new Date()), label: 'Today' },
  yesterday: { startDate: startOfDay(subDays(new Date(), 1)), endDate: endOfDay(subDays(new Date(), 1)), label: 'Yesterday' },
  thisWeek: { startDate: startOfWeek(new Date()), endDate: endOfWeek(new Date()), label: 'This Week' },
  thisMonth: { startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()), label: 'This Month' },
  lastMonth: { startDate: startOfMonth(subMonths(new Date(), 1)), endDate: endOfMonth(subMonths(new Date(), 1)), label: 'Last Month' }
}

export default function ReportFilters({ 
  currentRange, 
  onRangeChange, 
  onExport,
  hideDates = false
}: { 
  currentRange: DateRange
  onRangeChange: (range: DateRange) => void
  onExport: (format: 'csv' | 'excel' | 'pdf') => void
  hideDates?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideDates && (
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', className: 'h-10 border-slate-200 bg-white' })}>
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            {currentRange.label}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Presets</DropdownMenuLabel>
              {Object.entries(presetRanges).map(([key, range]) => (
                <DropdownMenuItem key={key} onClick={() => onRangeChange(range)}>
                  {range.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'default', className: 'h-10 bg-slate-900 hover:bg-slate-800' })}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport('csv')}>
            <FileText className="mr-2 h-4 w-4 text-slate-500" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('excel')}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
            Export as Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="mr-2 h-4 w-4 text-rose-500" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
