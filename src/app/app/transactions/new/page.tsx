import { Suspense } from 'react'
import { TransactionForm } from '@/domains/transactions/components/TransactionForm'
import { getAccounts, getPartiesForSelect, getRecentCategories } from '@/domains/transactions/actions'
import { ArrowLeft } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { Button } from '@/components/ui/button'

export default async function NewTransactionPage() {
  const [accountsRes, partiesRes, categoriesRes] = await Promise.all([
    getAccounts(),
    getPartiesForSelect({}),
    getRecentCategories()
  ])

  const accounts = accountsRes.success ? (accountsRes.data as any[]) : []
  const parties = partiesRes.success ? (partiesRes.data as any[]) : []
  const recentCategories = categoriesRes.success ? (categoriesRes.data as string[]) : []

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/app/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">নতুন লেনদেন</h2>
      </div>

      <Suspense fallback={<div className="h-[400px] w-full max-w-lg mx-auto bg-slate-100 animate-pulse rounded-2xl" />}>
        <TransactionForm 
          accounts={accounts} 
          parties={parties} 
          recentCategories={recentCategories} 
        />
      </Suspense>
    </div>
  )
}
