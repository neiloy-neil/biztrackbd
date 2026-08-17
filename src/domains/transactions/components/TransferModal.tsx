'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getAccounts, createTransfer } from '../actions'

type Account = { id: string; name: string; type: string }

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_money: 'Mobile Money',
}

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  excludeId,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  accounts: Account[]
  excludeId?: string
  disabled?: boolean
}) {
  const options = accounts.filter((a) => a.id !== excludeId)

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        >
          <option value="">একটি অ্যাকাউন্ট বেছে নিন</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({ACCOUNT_TYPE_LABELS[a.type] ?? a.type})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}

export function TransferModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingAccounts(true)
    getAccounts().then((res) => {
      if (res?.success) setAccounts((res.data as Account[]) ?? [])
      setLoadingAccounts(false)
    })
  }, [open])

  const reset = () => {
    setFromId('')
    setToId('')
    setAmount('')
    setNotes('')
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (!fromId || !toId) {
      toast.error('উভয় অ্যাকাউন্ট বেছে নিন')
      return
    }
    if (!amt || amt <= 0) {
      toast.error('সঠিক পরিমাণ দিন')
      return
    }

    setIsPending(true)
    const res = await createTransfer({
      amount: amt,
      from_account_id: fromId,
      to_account_id: toId,
      notes: notes.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    })
    setIsPending(false)

    if (res?.success) {
      toast.success('ট্রান্সফার সম্পন্ন হয়েছে')
      handleClose(false)
    } else {
      toast.error(res?.error || 'ট্রান্সফার ব্যর্থ হয়েছে')
    }
  }

  const fromAccount = accounts.find((a) => a.id === fromId)
  const toAccount = accounts.find((a) => a.id === toId)
  const canSwap = fromId && toId

  const swap = () => {
    setFromId(toId)
    setToId(fromId)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
            ফান্ড ট্রান্সফার
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingAccounts ? (
            <div className="space-y-3">
              <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
              <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            </div>
          ) : (
            <>
              <AccountSelect
                label="থেকে (From)"
                value={fromId}
                onChange={setFromId}
                accounts={accounts}
                excludeId={toId}
                disabled={isPending}
              />

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={swap}
                  disabled={!canSwap || isPending}
                  className="rounded-full border border-slate-200 p-2 text-slate-400 transition-colors hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-30"
                  title="Swap accounts"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              </div>

              <AccountSelect
                label="তে (To)"
                value={toId}
                onChange={setToId}
                accounts={accounts}
                excludeId={fromId}
                disabled={isPending}
              />
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">পরিমাণ (৳)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              নোট <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              type="text"
              placeholder="যেমন: বেতন পরিশোধ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
          </div>

          {fromAccount && toAccount && amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">
              <span className="font-semibold">{fromAccount.name}</span>
              {' থেকে '}
              <span className="font-semibold">{toAccount.name}</span>
              {'-এ ৳'}
              <span className="font-semibold">{parseFloat(amount).toLocaleString('bn-BD')}</span>
              {' ট্রান্সফার হবে'}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            বাতিল
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !fromId || !toId || !amount || parseFloat(amount) <= 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? 'প্রক্রিয়াকরণ...' : 'ট্রান্সফার করুন'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
