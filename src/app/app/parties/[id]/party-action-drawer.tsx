'use client'

import { useState, useTransition } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react'
import { createTransaction } from '@/domains/transactions/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type Account = { id: string; name: string; type: string }
type TransactionType = 'sale' | 'purchase' | 'expense' | 'payment_in' | 'payment_out'

type ActionConfig = {
  type: TransactionType
  label: string
  icon: React.ReactNode
  color: string
  drawerTitle: string
  amountLabel: string
  /** Credit entries (sale / expense) have no cash flow — no account needed */
  requiresAccount: boolean
}

function getActions(isCustomer: boolean): [ActionConfig, ActionConfig] {
  if (isCustomer) {
    return [
      {
        type: 'sale',
        label: 'বাকি দিলাম',
        icon: <ArrowUpRight className="h-5 w-5" />,
        color: 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200',
        drawerTitle: 'বাকিতে বিক্রি করলাম',
        amountLabel: 'কত টাকার পণ্য দিলাম?',
        requiresAccount: false,
      },
      {
        type: 'payment_in',
        label: 'টাকা পেলাম',
        icon: <ArrowDownLeft className="h-5 w-5" />,
        color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200',
        drawerTitle: 'কাস্টমারের কাছ থেকে টাকা পেলাম',
        amountLabel: 'কত টাকা পেলাম?',
        requiresAccount: true,
      },
    ]
  }
  return [
    {
      type: 'purchase',
      label: 'পণ্য কিনলাম',
      icon: <ArrowDownLeft className="h-5 w-5" />,
      color: 'bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 border border-orange-200',
      drawerTitle: 'সাপ্লায়ারের কাছ থেকে পণ্য কিনলাম',
      amountLabel: 'কত টাকার পণ্য কিনলাম?',
      requiresAccount: false,
    },
    {
      type: 'payment_out',
      label: 'টাকা দিলাম',
      icon: <ArrowUpRight className="h-5 w-5" />,
      color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200',
      drawerTitle: 'সাপ্লায়ারকে টাকা দিলাম',
      amountLabel: 'কত টাকা দিলাম?',
      requiresAccount: true,
    },
  ]
}

function ActionDrawer({
  action,
  partyId,
  partyName,
  accounts,
}: {
  action: ActionConfig
  partyId: string
  partyName: string
  accounts: Account[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const cashAccounts = accounts.filter(a => a.type === 'cash')
  const displayAccounts = cashAccounts.length > 0 ? cashAccounts : accounts
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => displayAccounts[0]?.id ?? ''
  )

  const reset = () => {
    setAmount('')
    setNote('')
    setSelectedAccountId(displayAccounts[0]?.id ?? '')
  }

  const handleSubmit = () => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      toast.error('সঠিক পরিমাণ দিন')
      return
    }
    if (action.requiresAccount && !selectedAccountId) {
      toast.error('অ্যাকাউন্ট নির্বাচন করুন')
      return
    }

    startTransition(async () => {
      const res = await createTransaction({
        type: action.type,
        amount: parsed,
        account_id: action.requiresAccount ? selectedAccountId : undefined,
        party_id: partyId,
        notes: note.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      } as any)

      if (res?.success) {
        toast.success('লেনদেন সফলভাবে যোগ হয়েছে')
        setOpen(false)
        reset()
        router.refresh()
      } else {
        toast.error(res?.error ?? 'ব্যর্থ হয়েছে')
      }
    })
  }

  return (
    <>
      <Button
        className={`h-16 flex flex-col items-center justify-center gap-1 ${action.color}`}
        onClick={() => setOpen(true)}
      >
        {action.icon}
        <span>{action.label}</span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-4">
            <DrawerTitle className="text-lg">{action.drawerTitle}</DrawerTitle>
            <p className="text-sm text-slate-500 text-center">{partyName}</p>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label className="font-medium">{action.amountLabel}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-lg">৳</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 h-14 text-2xl font-bold"
                  autoFocus
                />
              </div>
            </div>

            {/* Account — only for cash-in / cash-out actions */}
            {action.requiresAccount && (
              <div className="space-y-2">
                <Label className="font-medium">কোন অ্যাকাউন্টে?</Label>
                <div className="flex flex-wrap gap-2">
                  {displayAccounts.map(acc => (
                    <Button
                      key={acc.id}
                      type="button"
                      variant={selectedAccountId === acc.id ? 'default' : 'outline'}
                      className={`flex-1 min-w-[80px] ${selectedAccountId === acc.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSelectedAccountId(acc.id)}
                    >
                      {acc.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Credit sale info banner */}
            {!action.requiresAccount && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                এটি বাকি লেনদেন — কোনো নগদ টাকা গণনা হবে না। পরে টাকা পেলে "{action.type === 'sale' ? 'টাকা পেলাম' : 'টাকা দিলাম'}" চাপুন।
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label className="font-medium text-slate-500">নোট (ঐচ্ছিক)</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="যেমন: আলু, পেঁয়াজ কিনলাম..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DrawerFooter className="pt-4 gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isPending || !amount}
              className="h-12 text-base font-semibold w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  সেভ হচ্ছে...
                </>
              ) : (
                'নিশ্চিত করুন'
              )}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => { reset(); setOpen(false) }}
            >
              বাতিল
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function PartyActionButtons({
  party,
  accounts,
}: {
  party: { id: string; name: string; type: string }
  accounts: Account[]
}) {
  const isCustomer = party.type === 'customer'
  const [action1, action2] = getActions(isCustomer)

  return (
    <div className="grid grid-cols-2 gap-4">
      <ActionDrawer action={action1} partyId={party.id} partyName={party.name} accounts={accounts} />
      <ActionDrawer action={action2} partyId={party.id} partyName={party.name} accounts={accounts} />
    </div>
  )
}
