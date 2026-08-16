import Link from 'next/link'
import { ArrowUpCircle, ArrowDownCircle, HandCoins, Receipt, Calculator } from 'lucide-react'

export function QuickActions() {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      <Link href="/transactions/new?type=sale" className="flex flex-col items-center justify-center p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-95">
        <ArrowUpCircle className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">বিক্রি</span>
      </Link>
      <Link href="/transactions/new?type=expense" className="flex flex-col items-center justify-center p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700 hover:bg-rose-100 transition-colors active:scale-95">
        <ArrowDownCircle className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">খরচ</span>
      </Link>
      <Link href="/transactions/new?type=payment_in" className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors active:scale-95">
        <HandCoins className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">টাকা পেলাম</span>
      </Link>
      <Link href="/transactions/new?type=payment_out" className="flex flex-col items-center justify-center p-3 bg-orange-50 rounded-xl border border-orange-100 text-orange-700 hover:bg-orange-100 transition-colors active:scale-95">
        <Receipt className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">টাকা দিলাম</span>
      </Link>
      <Link href="/closing" className="flex flex-col items-center justify-center p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-700 hover:bg-purple-100 transition-colors active:scale-95">
        <Calculator className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">ডে ক্লোজ</span>
      </Link>
    </div>
  )
}
