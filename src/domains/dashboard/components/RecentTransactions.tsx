import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRecentTransactions } from '../actions'
import { formatBanglaCurrency } from '@/lib/utils/bangla'
import { TransactionAudit } from '@/domains/transactions/components/TransactionAudit'
import { VoidTransactionButton } from '@/domains/transactions/components/VoidTransactionButton'
import { ReturnSaleModal } from '@/domains/transactions/components/ReturnSaleModal'

export async function RecentTransactions() {
  const res = await getRecentTransactions({ limit: 5 })

  if (!res?.success || !res.data) {
    return null
  }

  const transactions = res.data as any[]

  return (
    <Card className="shadow-sm mt-6">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-bold text-slate-800">সাম্প্রতিক লেনদেন</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">কোনো লেনদেন নেই</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map(txn => (
              <div key={txn.id} className="flex flex-col p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {txn.parties?.name || (txn.type === 'expense' ? 'খরচ' : 'বিবিধ')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(txn.transaction_date).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className={`text-sm font-bold ${['sale', 'payment_in'].includes(txn.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {['sale', 'payment_in'].includes(txn.type) ? '+' : '-'} ৳ {formatBanglaCurrency(txn.total_amount)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <TransactionAudit transactionId={txn.id} />
                  
                  <div className="flex gap-2">
                    {txn.type === 'sale' && txn.state === 'completed' ? (
                      <ReturnSaleModal transactionId={txn.id} />
                    ) : (
                      <VoidTransactionButton transactionId={txn.id} state={txn.state} />
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
