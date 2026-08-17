import { Suspense } from 'react'
import { getParty, getPartyTransactions, deleteParty } from '@/domains/parties/actions'
import { getAccounts } from '@/domains/transactions/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { format } from '@/lib/utils/date'
import { PartyActionButtons } from './party-action-drawer'
import { VoidTransactionButton } from '@/domains/transactions/components/VoidTransactionButton'
import { TransactionAudit } from '@/domains/transactions/components/TransactionAudit'

async function PartyDetails({ id }: { id: string }) {
  const [partyRes, accountsRes, transRes] = await Promise.all([
    getParty({ id }),
    getAccounts(),
    getPartyTransactions({ id }),
  ])

  const party = partyRes?.success ? partyRes.data : null
  const partyError = !partyRes?.success ? partyRes?.error : null

  if (!partyRes?.success || !party) {
    return <div className="text-center text-red-500 py-10">{'পার্টি পাওয়া যায়নি'} ({partyError})</div>
  }

  const accounts = accountsRes?.success ? (accountsRes.data as any[]) : []
  const transactions = transRes?.success ? transRes.data : []

  const formatCurrency = (amount: number) =>
    '৳' + Math.abs(isNaN(amount) ? 0 : amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })

  const isCustomer = party.type === 'customer'
  const currentDue = Number(party.current_due ?? 0)

  const txnLabel = (type: string) => {
    if (type === 'sale') return 'বিক্রি'
    if (type === 'payment_in') return 'জমা (ক্যাশ-ইন)'
    if (type === 'purchase') return 'ক্রয়'
    if (type === 'expense') return 'খরচ'
    if (type === 'payment_out') return 'পেমেন্ট (ক্যাশ-আউট)'
    return type
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Due */}
      <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className={`h-2 ${currentDue > 0 ? (isCustomer ? 'bg-red-500' : 'bg-orange-500') : 'bg-emerald-500'}`} />
        <CardContent className="p-6 text-center">
          <p className="text-sm font-medium text-slate-500 mb-1">
            {isCustomer
              ? (currentDue >= 0 ? 'মোট পাবো' : 'অগ্রিম পেয়েছি')
              : (currentDue >= 0 ? 'মোট দিতে হবে' : 'অগ্রিম দিয়েছি')}
          </p>
          <h2 className={`text-4xl font-bold ${currentDue > 0 ? (isCustomer ? 'text-red-500' : 'text-orange-500') : 'text-emerald-500'}`}>
            {formatCurrency(currentDue)}
          </h2>
        </CardContent>
      </Card>

      {/* Quick Action Buttons — wired up with drawer forms */}
      <PartyActionButtons party={{ id: party.id, name: party.name, type: party.type }} accounts={accounts} />

      {/* Statement & WhatsApp */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={`/parties/${party.id}/statement`}>
          <Button variant="outline" className="w-full h-12">
            <FileText className="mr-2 h-4 w-4" />
            {'স্টেটমেন্ট'}
          </Button>
        </Link>
        {party.phone ? (
          <a
            href={`https://wa.me/88${party.phone}?text=${encodeURIComponent(`আপনার বর্তমান বকেয়া ৳${Math.abs(currentDue)}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full h-12 text-[#25D366] hover:text-[#1eb355]">
              <MessageCircle className="mr-2 h-4 w-4" />
              {'হোয়াটসঅ্যাপ'}
            </Button>
          </a>
        ) : (
          <Button variant="outline" className="w-full h-12 text-slate-400" disabled>
            <MessageCircle className="mr-2 h-4 w-4" />
            {'ফোন নেই'}
          </Button>
        )}
      </div>

      {/* Delete party — only when balance is zero */}
      {currentDue === 0 && (
        <form
          action={async () => {
            'use server'
            const res = await deleteParty({ id: party.id })
            if (res?.success) {
              const { redirect } = await import('next/navigation')
              redirect('/app/parties')
            }
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            এই পার্টি মুছে ফেলুন
          </button>
        </form>
      )}

      {/* Transactions List */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">{'লেনদেন বিবরণী'}</h3>
        <Card>
          <div className="divide-y">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">{'কোনো লেনদেন পাওয়া যায়নি'}</div>
            ) : (
              transactions.map((txn: any) => (
                <div key={txn.id} className="flex flex-col hover:bg-slate-50 transition-colors">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{txnLabel(txn.type)}</p>
                      <p className="text-sm text-slate-500">
                      {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className={`font-bold ${
                    (isCustomer && txn.type === 'payment_in') || (!isCustomer && txn.type === 'purchase') || (!isCustomer && txn.type === 'payment_out')
                      ? 'text-emerald-600'
                      : (isCustomer && txn.type === 'sale') || (!isCustomer && txn.type === 'expense')
                      ? 'text-red-600'
                      : 'text-slate-900'
                  }`}>
                    {formatCurrency(txn.total_amount)}
                  </div>
                </div>
                <div className="px-4 pb-4 flex items-center justify-between bg-slate-50 border-t">
                  <TransactionAudit transactionId={txn.id} />
                  <VoidTransactionButton transactionId={txn.id} state={txn.state} />
                </div>
              </div>
            ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center justify-between mb-2">
        <Link href="/parties">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-[200px] w-full bg-slate-100 animate-pulse rounded-2xl" />}>
        <PartyDetails id={resolvedParams.id} />
      </Suspense>
    </div>
  )
}
