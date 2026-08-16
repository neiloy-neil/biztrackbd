'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getParty, getPartyTransactions } from '@/domains/parties/actions'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'
import { format } from '@/lib/utils/date'

export default function StatementPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [party, setParty] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // the params might be a promise in next 15 but we'll await it or just use React.use() if needed. 
      // Actually since it's a client component Next 14 handles params directly, Next 15 needs `use(params)`.
      // To be safe against 15.3, let's treat it as a promise if it is one.
      const resolved = await params
      const [partyRes, txnsRes] = await Promise.all([
        getParty({ id: resolved.id }),
        getPartyTransactions({ id: resolved.id })
      ])

      if (partyRes.success) setParty(partyRes.data)
      if (txnsRes.success) setTransactions(txnsRes.data as any[])
      setLoading(false)
    }
    load()
  }, [params])

  if (loading) return <div className="p-8 text-center">লোড হচ্ছে...</div>
  if (!party) return <div className="p-8 text-center text-red-500">পার্টি পাওয়া যায়নি</div>

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' }).format(Math.abs(amount))
  }

  const isCustomer = party.type === 'customer'
  const currentDue = Number(party.current_due)

  return (
    <div className="bg-white min-h-screen">
      {/* Non-printable header */}
      <div className="print:hidden p-4 border-b flex items-center justify-between bg-slate-50">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> ব্যাক
        </Button>
        <Button onClick={() => window.print()} className="bg-[#007AFF] hover:bg-[#005bb5]">
          <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
        </Button>
      </div>

      {/* Printable Statement Area */}
      <div className="p-8 max-w-3xl mx-auto print:p-0 print:w-full">
        
        {/* Statement Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900 mb-2">হিসাবের বিবরণী (Statement)</h1>
          <p className="text-slate-500">তারিখ: {format(new Date(), 'dd MMMM, yyyy')}</p>
        </div>

        {/* Party Info & Summary */}
        <div className="flex justify-between items-end border-b pb-6 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{party.name}</h2>
            <p className="text-slate-600">{party.phone || 'মোবাইল নাম্বার নেই'}</p>
            <p className="text-slate-600">{party.address || 'ঠিকানা নেই'}</p>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-slate-500 uppercase">
              {isCustomer ? 'মোট বকেয়া (Due)' : 'মোট পাওনা (Payable)'}
            </p>
            <h3 className="text-3xl font-bold text-slate-900">
              {formatCurrency(currentDue)}
            </h3>
          </div>
        </div>

        {/* Transaction Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 text-slate-900">
              <th className="py-3 px-2">তারিখ</th>
              <th className="py-3 px-2">বিবরণ</th>
              <th className="py-3 px-2 text-right">ডেবিট (Debit)</th>
              <th className="py-3 px-2 text-right">ক্রেডিট (Credit)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {transactions.map((txn, idx) => {
              // Standard Accounting:
              // For Customer: Sale = Debit (They owe us more), Payment In = Credit (They owe us less)
              // For Supplier: Purchase = Credit (We owe them more), Payment Out = Debit (We owe them less)
              let debit = 0
              let credit = 0

              if (isCustomer) {
                if (txn.type === 'sale') debit = txn.total_amount
                if (txn.type === 'payment_in') credit = txn.total_amount
              } else {
                if (txn.type === 'purchase') credit = txn.total_amount
                if (txn.type === 'payment_out') debit = txn.total_amount
              }

              return (
                <tr key={txn.id} className="text-slate-800">
                  <td className="py-3 px-2">{format(new Date(txn.transaction_date), 'dd/MM/yyyy')}</td>
                  <td className="py-3 px-2 capitalize">
                    {txn.type === 'sale' ? 'Sale (বিক্রি)' : 
                     txn.type === 'payment_in' ? 'Payment Received (ক্যাশ-ইন)' : 
                     txn.type === 'purchase' ? 'Purchase (ক্রয়)' : 
                     txn.type === 'payment_out' ? 'Payment Given (ক্যাশ-আউট)' : txn.type}
                  </td>
                  <td className="py-3 px-2 text-right">{debit > 0 ? formatCurrency(debit) : '-'}</td>
                  <td className="py-3 px-2 text-right">{credit > 0 ? formatCurrency(credit) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {/* Footer */}
        <div className="mt-16 text-center text-slate-500 text-sm print:fixed print:bottom-0 print:w-full">
          Generated securely by BizTrack BD
        </div>
      </div>
    </div>
  )
}
