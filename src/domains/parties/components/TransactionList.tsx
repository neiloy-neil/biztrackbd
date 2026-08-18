'use client'

import { useState, useEffect } from 'react'
import { getPartyTransactions } from '@/domains/parties/actions'
import { Card } from '@/components/ui/card'
import { format } from '@/lib/utils/date'
import { TransactionAudit } from '@/domains/transactions/components/TransactionAudit'
import { VoidTransactionButton } from '@/domains/transactions/components/VoidTransactionButton'

export function TransactionList({ initialTransactions, partyId, isCustomer }: { initialTransactions: any[], partyId: string, isCustomer: boolean }) {
  const [page, setPage] = useState(1)
  const [transactions, setTransactions] = useState<any[]>(initialTransactions)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialTransactions.length === 50)

  useEffect(() => {
    setTransactions(initialTransactions)
    setPage(1)
    setHasMore(initialTransactions.length === 50)
  }, [initialTransactions])

  const loadMore = async () => {
    setLoading(true)
    const nextPage = page + 1
    const res = await getPartyTransactions({ id: partyId, page: nextPage, limit: 50 })
    if (res?.success && res.data) {
      setTransactions(prev => [...prev, ...res.data])
      setPage(nextPage)
      setHasMore(res.data.length === 50)
    }
    setLoading(false)
  }

  const formatCurrency = (amount: number) =>
    '৳' + Math.abs(isNaN(amount) ? 0 : amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })

  const txnLabel = (type: string) => {
    if (type === 'sale') return 'বিক্রি'
    if (type === 'payment_in') return 'জমা (ক্যাশ-ইন)'
    if (type === 'purchase') return 'ক্রয়'
    if (type === 'expense') return 'খরচ'
    if (type === 'payment_out') return 'পেমেন্ট (ক্যাশ-আউট)'
    return type
  }

  return (
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
      {hasMore && (
        <div className="text-center pt-4">
          <button 
            onClick={loadMore} 
            disabled={loading}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium"
          >
            {loading ? 'লোড হচ্ছে...' : 'আরও লোড করুন (Load More)'}
          </button>
        </div>
      )}
    </div>
  )
}
