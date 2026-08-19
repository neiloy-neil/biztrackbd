'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Lock, Calculator, TrendingUp, TrendingDown, CheckCircle2, ArrowLeft, Loader2, Wallet, Landmark, Smartphone } from 'lucide-react'
import { closeDay } from '../actions'
import { toast } from 'sonner'
import { AppLink as Link } from '@/components/AppLink'
import { cn } from '@/lib/utils'
import { RequirePermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/auth/rbac'
import { addToOfflineQueue } from '@/lib/offline/queue'

interface AccountBalance {
  account_id: string
  account_name: string
  account_type: string
  system_balance: number
}

interface ClosingClientProps {
  today: string
  closingData: {
    status: 'open' | 'closed'
    closing?: any
    summary?: any
  }
  reconciliationAccounts?: AccountBalance[]
}

export function ClosingClient({ today, closingData, reconciliationAccounts = [] }: ClosingClientProps) {
  const isClosed = closingData.status === 'closed'
  const record = closingData.closing
  const summary = isClosed ? record.summary : closingData.summary

  const [actuals, setActuals] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleActualChange = (accountId: string, val: string) => {
    setActuals(prev => ({ ...prev, [accountId]: val }))
  }

  const handleReasonChange = (accountId: string, val: string) => {
    setReasons(prev => ({ ...prev, [accountId]: val }))
  }

  const handleCloseDay = async () => {
    // Validation
    const emptyActuals = reconciliationAccounts.filter(acc => actuals[acc.account_id] === undefined || actuals[acc.account_id] === '')
    if (emptyActuals.length > 0) {
      toast.error('সকল অ্যাকাউন্টের Actual Balance ইনপুট দিন')
      return
    }

    const reconciliations = reconciliationAccounts.map(acc => {
      const actual_balance = parseFloat(actuals[acc.account_id]) || 0
      const difference = actual_balance - acc.system_balance
      return {
        account_id: acc.account_id,
        actual_balance,
        difference,
        reason: reasons[acc.account_id] || ''
      }
    })

    const missingReason = reconciliations.find(r => r.difference !== 0 && !r.reason.trim())
    if (missingReason) {
      const acc = reconciliationAccounts.find(a => a.account_id === missingReason.account_id)
      toast.error(`${acc?.account_name} এর cash shortage/surplus এর কারণ উল্লেখ করুন`)
      return
    }

    setIsSubmitting(true)

    const payload = { 
      date: today, 
      reconciliations: reconciliations.map(r => ({ account_id: r.account_id, actual_balance: r.actual_balance, reason: r.reason }))
    }

    if (!navigator.onLine) {
      const idempotencyKey = `closing_${today}`
      await addToOfflineQueue({
        id: idempotencyKey,
        idempotencyKey,
        type: 'daily_closing',
        payload,
      })
      setIsSubmitting(false)
      toast.success('অফলাইনে সেভ হয়েছে — নেটওয়ার্ক ফিরলে সিঙ্ক হবে')
      return
    }

    const res = await closeDay(payload)
    setIsSubmitting(false)

    if (res?.success) {
      toast.success('আজকের হিসাব সফলভাবে ক্লোজ করা হয়েছে')
      window.location.reload()
      router.refresh()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const formatTk = (amount: number) => `৳${Math.abs(amount).toLocaleString('en-IN')}`

  const getAccountIcon = (type: string) => {
    if (type === 'cash') return <Wallet className="w-5 h-5" />
    if (type === 'bank') return <Landmark className="w-5 h-5" />
    return <Smartphone className="w-5 h-5" />
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3 pb-2 border-b">
        <Link href="/app/dashboard" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
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

      <Card className={cn("border-2 shadow-sm", isClosed ? "border-emerald-100" : "border-slate-200")}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-500" />
            অ্যাকাউন্ট মেলানো (Account Reconciliation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isClosed ? (
             <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100">
               এই দিনের হিসাব ক্লোজ করা হয়েছে। ক্যাশ পার্থক্য ছিল: {formatTk(record.difference)}
             </div>
          ) : (
            reconciliationAccounts.map(acc => {
              const actualStr = actuals[acc.account_id] || ''
              const actual = parseFloat(actualStr) || 0
              const difference = actualStr === '' ? 0 : actual - acc.system_balance
              const needsReason = actualStr !== '' && difference !== 0

              return (
                <div key={acc.account_id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                      {getAccountIcon(acc.account_type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{acc.account_name}</h3>
                      <p className="text-xs text-slate-500 uppercase font-medium">{acc.account_type}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">সিস্টেম ব্যালেন্স</p>
                      <p className="text-lg font-bold text-slate-900">{formatTk(acc.system_balance)}</p>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/50">
                      <p className="text-xs text-blue-600/80 mb-1 font-medium">প্রকৃত ব্যালেন্স</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">৳</span>
                        <Input 
                          type="number" 
                          value={actualStr}
                          onChange={(e) => handleActualChange(acc.account_id, e.target.value)}
                          className="pl-8 font-bold bg-white h-10"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {actualStr !== '' && (
                    <div className={cn(
                      "p-3 rounded-lg border flex items-center justify-between text-sm",
                      difference === 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                    )}>
                      <div className="flex items-center gap-2">
                        {difference === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
                        <span className={cn("font-medium", difference === 0 ? "text-emerald-700" : "text-rose-700")}>
                          পার্থক্য
                        </span>
                      </div>
                      <span className={cn("font-bold", difference === 0 ? "text-emerald-700" : "text-rose-700")}>
                        {difference > 0 ? '+' : ''}{difference === 0 ? '৳0' : formatTk(difference)}
                      </span>
                    </div>
                  )}

                  {needsReason && (
                    <div className="space-y-2 animate-in fade-in">
                      <Label className="text-xs text-rose-700 font-medium">পার্থক্যের কারণ *</Label>
                      <Textarea 
                        value={reasons[acc.account_id] || ''}
                        onChange={(e) => handleReasonChange(acc.account_id, e.target.value)}
                        placeholder="কারণ লিখুন..."
                        className="h-20 border-rose-200 focus-visible:ring-rose-500"
                      />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
        
        {!isClosed && (
          <RequirePermission permission={PERMISSIONS.CLOSING_MANAGE}>
            <CardFooter className="bg-slate-50/50 pt-4 pb-4 px-6 border-t rounded-b-xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <Button 
                onClick={handleCloseDay} 
                disabled={isSubmitting || reconciliationAccounts.length === 0} 
                className="w-full h-12 text-base font-semibold"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ক্লোজ হচ্ছে...</>
                ) : (
                  'আজকের হিসাব লক করুন'
                )}
              </Button>
            </CardFooter>
          </RequirePermission>
        )}
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base text-slate-800">আজকের লেনদেন সারসংক্ষেপ</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">মোট বিক্রি (Total Sales)</p>
              <p className="text-lg font-bold text-slate-800">{formatTk(summary?.total_sales || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">মোট খরচ (Total Expenses)</p>
              <p className="text-lg font-bold text-slate-800">{formatTk(summary?.total_expenses || 0)}</p>
            </div>
            <div className="space-y-1 col-span-2 pt-2 border-t">
              <p className="text-xs text-slate-500">দিনশেষে লাভ/ক্ষতি (Profit)</p>
              <p className={cn("text-lg font-bold", (summary?.total_profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {(summary?.total_profit || 0) < 0 ? '-' : ''}{formatTk(summary?.total_profit || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
