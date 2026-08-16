import { Suspense } from 'react'
import { getParty, getPartyTransactions } from '@/domains/parties/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, MessageCircle, ArrowLeft, ArrowUpRight, ArrowDownLeft, FileText, Share2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { format } from '@/lib/utils/date'

async function PartyDetails({ id }: { id: string }) {
  const partyRes = await getParty({ id })
  const party = partyRes?.success ? partyRes.data : null
  const partyError = !partyRes?.success ? partyRes?.error : null

  if (!partyRes?.success || !party) {
    return <div className="text-center text-red-500 py-10">পার্টি পাওয়া যায়নি ({partyError})</div>
  }

  const transRes = await getPartyTransactions({ id })
  const transactions = transRes?.success ? transRes.data : []
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' }).format(Math.abs(amount))
  }

  const isCustomer = party.type === 'customer'
  const currentDue = Number(party.current_due ?? 0)

  return (
    <div className="space-y-6">
      {/* Top Banner with Due */}
      <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className={`h-2 ${currentDue > 0 ? (isCustomer ? 'bg-red-500' : 'bg-orange-500') : 'bg-emerald-500'}`} />
        <CardContent className="p-6 text-center">
          <p className="text-sm font-medium text-slate-500 mb-1">
            {isCustomer 
              ? (currentDue >= 0 ? 'মোট পাবো' : 'অগ্রিম পেয়েছি') 
              : (currentDue >= 0 ? 'মোট দিতে হবে' : 'অগ্রিম দিয়েছি')}
          </p>
          <h2 className={`text-4xl font-bold ${currentDue > 0 ? (isCustomer ? 'text-red-500' : 'text-orange-500') : 'text-emerald-500'}`}>
            {formatCurrency(currentDue)}
          </h2>
        </CardContent>
      </Card>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 gap-4">
        {isCustomer ? (
          <>
            <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200">
              <ArrowUpRight className="h-5 w-5" />
              <span>বাকি দিলাম</span>
            </Button>
            <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200">
              <ArrowDownLeft className="h-5 w-5" />
              <span>টাকা পেলাম</span>
            </Button>
          </>
        ) : (
          <>
            <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 border border-orange-200">
              <ArrowDownLeft className="h-5 w-5" />
              <span>পণ্য কিনলাম</span>
            </Button>
            <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200">
              <ArrowUpRight className="h-5 w-5" />
              <span>টাকা দিলাম</span>
            </Button>
          </>
        )}
      </div>

      {/* Statements & Reminder Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={`/parties/${party.id}/statement`}>
          <Button variant="outline" className="w-full h-12">
            <FileText className="mr-2 h-4 w-4" /> স্টেটমেন্ট
          </Button>
        </Link>
        <Link href={`https://wa.me/88${party.phone}?text=${encodeURIComponent(`আপনার বর্তমান বকেয়া ৳${Math.abs(currentDue)}`)}`} target="_blank">
          <Button variant="outline" className="w-full h-12 text-[#25D366] hover:text-[#1eb355]">
            <MessageCircle className="mr-2 h-4 w-4" /> হোয়াটসঅ্যাপ
          </Button>
        </Link>
      </div>

      {/* Transactions List */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">লেনদেন বিবরণী</h3>
        <Card>
          <div className="divide-y">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">কোনো লেনদেন পাওয়া যায়নি</div>
            ) : (
              transactions.map((txn: any) => (
                <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-slate-900 capitalize">
                      {txn.type === 'sale' ? 'বিক্রি' : 
                       txn.type === 'payment_in' ? 'জমা (ক্যাশ-ইন)' : 
                       txn.type === 'purchase' ? 'ক্রয়' : 
                       txn.type === 'payment_out' ? 'খরচ (ক্যাশ-আউট)' : txn.type}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className={`font-bold ${
                    (isCustomer && txn.type === 'payment_in') || (!isCustomer && txn.type === 'purchase')
                      ? 'text-emerald-600' 
                      : (isCustomer && txn.type === 'sale') || (!isCustomer && txn.type === 'payment_out')
                      ? 'text-red-600'
                      : 'text-slate-900'
                  }`}>
                    {formatCurrency(txn.total_amount)}
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
