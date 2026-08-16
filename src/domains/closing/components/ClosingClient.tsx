'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Lock, Calculator, TrendingUp, TrendingDown, CheckCircle2, ArrowLeft } from 'lucide-react'
import { closeDay } from '../actions'
import { toast } from 'sonner'
import { AppLink as Link } from '@/components/AppLink'
import { cn } from '@/lib/utils'
import { RequirePermission } from '@/hooks/usePermissions'

interface ClosingClientProps {
  today: string
  closingData: {
    status: 'open' | 'closed'
    closing?: any // Closed record
    summary?: any // Open summary
  }
}

export function ClosingClient({ today, closingData }: ClosingClientProps) {
  const isClosed = closingData.status === 'closed'
  const record = closingData.closing
  const summary = isClosed ? record.summary : closingData.summary

  const [actualCashStr, setActualCashStr] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const expectedCash = isClosed ? record.expected_cash : summary.expected_cash
  const actualCash = parseFloat(actualCashStr) || 0
  
  const difference = isClosed 
    ? record.difference 
    : (actualCashStr === '' ? 0 : actualCash - expectedCash)

  const requiresReason = !isClosed && difference !== 0 && actualCashStr !== ''

  const handleCloseDay = async () => {
    if (actualCashStr === '') {
      toast.error('অনুগ্রহ করে Actual Cash ইনপুট দিন')
      return
    }
    if (requiresReason && !reason.trim()) {
      toast.error('Cash shortage বা surplus এর জন্য একটি কারণ উল্লেখ করুন')
      return
    }

    setIsSubmitting(true)
    const res = await closeDay({
      date: today,
      expected_cash: expectedCash,
      actual_cash: actualCash,
      difference: difference,
      reason: reason,
      summary: summary
    })
    setIsSubmitting(false)

    if (res?.success) {
      toast.success('আজকের হিসাব সফলভাবে ক্লোজ করা হয়েছে')
      window.location.reload()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const formatTk = (amount: number) => `৳${Math.abs(amount).toLocaleString('en-IN')}`

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">হিসাব ক্লোজিং (Day Close)</h2>
          <p className="text-sm text-slate-500">{today}</p>
        </div>
        {isClosed && (
          <div className="ml-auto flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Closed
          </div>
        )}
      </div>

      {/* Main Closing Section */}
      <Card className={cn("border-2 shadow-sm", isClosed ? "border-emerald-100" : "border-slate-200")}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-500" />
            ক্যাশ মেলানো (Cash Reconciliation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">সিস্টেম অনুযায়ী ক্যাশ (Expected)</p>
              <p className="text-2xl font-bold text-slate-900">{formatTk(expectedCash)}</p>
            </div>
            
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
              <p className="text-sm text-blue-600/80 mb-1 font-medium">প্রকৃত ক্যাশ (Actual)</p>
              {isClosed ? (
                <p className="text-2xl font-bold text-blue-900">{formatTk(record.actual_cash)}</p>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">৳</span>
                  <Input 
                    type="number" 
                    value={actualCashStr}
                    onChange={(e) => setActualCashStr(e.target.value)}
                    className="pl-8 text-xl font-bold bg-white h-12"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Difference */}
          {((!isClosed && actualCashStr !== '') || isClosed) && (
            <div className={cn(
              "p-4 rounded-xl border flex items-center justify-between",
              difference === 0 
                ? "bg-emerald-50 border-emerald-100" 
                : "bg-rose-50 border-rose-100"
            )}>
              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : difference < 0 ? (
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-rose-600" />
                )}
                <span className={cn(
                  "font-medium",
                  difference === 0 ? "text-emerald-700" : "text-rose-700"
                )}>
                  পার্থক্য (Difference)
                </span>
              </div>
              <span className={cn(
                "text-xl font-bold",
                difference === 0 ? "text-emerald-700" : "text-rose-700"
              )}>
                {difference > 0 ? '+' : ''}{difference === 0 ? '৳0' : formatTk(difference)}
              </span>
            </div>
          )}

          {/* Reason Field */}
          {(!isClosed && requiresReason) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="reason" className="text-rose-700 font-medium">ক্যাশ না মেলার কারণ (Reason) *</Label>
              <Textarea 
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: ক্যাশ শর্টেজ (Cash shortage)"
                className="border-rose-200 focus-visible:ring-rose-500"
              />
            </div>
          )}
          {isClosed && record.reason && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-100">
              <span className="font-semibold">কারণ:</span> {record.reason}
            </div>
          )}

        </CardContent>
        {!isClosed && (
          <RequirePermission permission="closing.manage">
            <CardFooter className="bg-slate-50/50 pt-4 pb-4 px-6 border-t rounded-b-xl">
              <Button 
                onClick={handleCloseDay} 
                disabled={isSubmitting} 
                className="w-full h-12 text-base font-semibold"
              >
                আজকের হিসাব লক করুন
              </Button>
            </CardFooter>
          </RequirePermission>
        )}
      </Card>

      {/* Daily Summary Breakdown */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base text-slate-800">আজকের লেনদেন সারসংক্ষেপ</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">মোট বিক্রি (Total Sales)</p>
              <p className="text-lg font-bold text-slate-800">{formatTk(summary.total_sales)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">মোট খরচ (Total Expenses)</p>
              <p className="text-lg font-bold text-slate-800">{formatTk(summary.total_expenses)}</p>
            </div>
            <div className="space-y-1 col-span-2 pt-2 border-t">
              <p className="text-xs text-slate-500">দিনশেষে লাভ/ক্ষতি (Profit)</p>
              <p className={cn("text-lg font-bold", summary.total_profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {summary.total_profit < 0 ? '-' : ''}{formatTk(summary.total_profit)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">ক্যাশ লেনদেন (Cash Movements)</h4>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">ক্যাশ বিক্রি (Cash Sales)</span>
              <span className="font-medium text-emerald-600">+{formatTk(summary.cash_sales)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">ক্যাশ রিসিভড (Cash Received)</span>
              <span className="font-medium text-emerald-600">+{formatTk(summary.cash_received)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">ক্যাশ খরচ (Cash Expenses)</span>
              <span className="font-medium text-rose-600">-{formatTk(summary.cash_expenses)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">ক্যাশ পেমেন্ট (Cash Paid)</span>
              <span className="font-medium text-rose-600">-{formatTk(summary.cash_paid)}</span>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">অন্যান্য ব্যালেন্স (Other Balances)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-pink-50 p-3 rounded-lg border border-pink-100">
                <p className="text-[10px] text-pink-600 font-semibold mb-1">bKash</p>
                <p className="text-sm font-bold text-pink-900">{formatTk(summary.balances.bkash)}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                <p className="text-[10px] text-orange-600 font-semibold mb-1">Nagad</p>
                <p className="text-sm font-bold text-orange-900">{formatTk(summary.balances.nagad)}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-[10px] text-blue-600 font-semibold mb-1">Bank</p>
                <p className="text-sm font-bold text-blue-900">{formatTk(summary.balances.bank)}</p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
