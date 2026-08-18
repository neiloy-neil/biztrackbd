import Link from 'next/link'
import { ArrowUpCircle, ArrowDownCircle, HandCoins, Receipt, Calculator, Package, ArrowLeftRight } from 'lucide-react'

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
      <Link href="/app/transactions/new?type=sale" className="flex flex-col items-center justify-center p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-95">
        <ArrowUpCircle className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">বিক্রি</span>
      </Link>
      <Link href="/app/transactions/new?type=income" className="flex flex-col items-center justify-center p-3 bg-teal-50 rounded-xl border border-teal-100 text-teal-700 hover:bg-teal-100 transition-colors active:scale-95">
        <ArrowUpCircle className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold text-center leading-tight">অন্যান্য<br/>আয়</span>
      </Link>
      <Link href="/app/transactions/new?type=purchase" className="flex flex-col items-center justify-center p-3 bg-orange-50 rounded-xl border border-orange-100 text-orange-700 hover:bg-orange-100 transition-colors active:scale-95">
        <Package className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">ক্রয়</span>
      </Link>
      <Link href="/app/transactions/new?type=expense" className="flex flex-col items-center justify-center p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700 hover:bg-rose-100 transition-colors active:scale-95">
        <ArrowDownCircle className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">খরচ</span>
      </Link>
      <Link href="/app/transactions/new?type=payment_in" className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors active:scale-95">
        <HandCoins className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">টাকা পেলাম</span>
      </Link>
      <Link href="/app/transactions/new?type=payment_out" className="flex flex-col items-center justify-center p-3 bg-orange-50 rounded-xl border border-orange-100 text-orange-700 hover:bg-orange-100 transition-colors active:scale-95">
        <Receipt className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">টাকা দিলাম</span>
      </Link>
      <Link href="/app/closing" className="flex flex-col items-center justify-center p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-700 hover:bg-purple-100 transition-colors active:scale-95">
        <Calculator className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">ডে ক্লোজ</span>
      </Link>
      <Link href="/app/settings?tab=transfer" className="flex flex-col items-center justify-center p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors active:scale-95">
        <ArrowLeftRight className="h-6 w-6 mb-1" />
        <span className="text-[11px] font-bold">ট্রান্সফার</span>
      </Link>
    </div>
  )
}
