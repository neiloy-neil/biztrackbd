import Link from 'next/link'
import { Banknote, Building2, Smartphone, Wallet, TrendingUp, Users, Truck, ChevronRight, MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBanglaCurrency } from '@/lib/utils/bangla'
import { getMoneyVisibility } from '../actions'
import { ProfitSparkline, ClosingVarianceStrip } from './MoneyVisibilityCharts'

type Account  = { id: string; name: string; type: string; balance: number }
type Party    = { id: string; name: string; phone: string | null; current_due: number }
type ProfitDay = { date: string; profit: number }
type Closing  = { date: string; difference: number; actual_cash: number; expected_cash: number }

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  cash:         <Banknote   className="h-4 w-4 text-emerald-600" />,
  bank:         <Building2  className="h-4 w-4 text-blue-600" />,
  mobile_money: <Smartphone className="h-4 w-4 text-violet-600" />,
}

const ACCOUNT_COLORS: Record<string, string> = {
  cash:         'bg-emerald-50 border-emerald-100',
  bank:         'bg-blue-50    border-blue-100',
  mobile_money: 'bg-violet-50  border-violet-100',
}

function buildWhatsAppUrl(phone: string | null, name: string, due: number): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const intl   = digits.startsWith('880') ? digits : digits.startsWith('0') ? `880${digits.slice(1)}` : `880${digits}`
  const text   = encodeURIComponent(`${name}, আপনার বকেয়া পরিমাণ ৳${due.toLocaleString('en-IN')}। অনুগ্রহ করে পরিশোধ করুন। - BizTrack BD`)
  return `https://wa.me/${intl}?text=${text}`
}

// ─── Account Breakdown ───────────────────────────────────────────────────────

function CashBreakdown({ accounts }: { accounts: Account[] }) {
  if (!accounts.length) return null
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-500" />
          টাকা কোথায় আছে
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {accounts.map(a => (
            <div
              key={a.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[130px] ${ACCOUNT_COLORS[a.type] ?? 'bg-slate-50 border-slate-100'}`}
            >
              {ACCOUNT_ICONS[a.type] ?? <Wallet className="h-4 w-4 text-slate-500" />}
              <div>
                <p className="text-[10px] text-slate-500 leading-none">{a.name}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">৳ {formatBanglaCurrency(Number(a.balance))}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-500">মোট ব্যালেন্স</span>
          <span className="text-sm font-bold text-slate-800">৳ {formatBanglaCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── 7-Day Profit Card ───────────────────────────────────────────────────────

function ProfitTrend({ data }: { data: ProfitDay[] }) {
  const today    = data[data.length - 1]
  const todayVal = today ? Number(today.profit) : 0
  const isUp     = todayVal >= 0

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            ৭ দিনের লাভ-ক্ষতি
          </CardTitle>
          <span className={`text-xs font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            আজ: ৳ {formatBanglaCurrency(Math.abs(todayVal))} {isUp ? '▲' : '▼'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <ProfitSparkline data={data} />
      </CardContent>
    </Card>
  )
}

// ─── Party Row ───────────────────────────────────────────────────────────────

function PartyRow({
  party,
  actionType,
  actionLabel,
}: {
  party: Party
  actionType: 'payment_in' | 'payment_out'
  actionLabel: string
}) {
  const waUrl = actionType === 'payment_in' ? buildWhatsAppUrl(party.phone, party.name, party.current_due) : null

  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
      <Link href={`/app/parties/${party.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{party.name}</p>
        <p className="text-xs text-slate-500">৳ {formatBanglaCurrency(Number(party.current_due))}</p>
      </Link>
      <div className="flex items-center gap-1 flex-shrink-0">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 transition-colors"
            title="WhatsApp-এ মেসেজ পাঠান"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        <Link
          href={`/app/transactions/new?type=${actionType}&party_id=${party.id}`}
          className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}

// ─── Debtors & Payables ──────────────────────────────────────────────────────

function TopDebtors({ parties }: { parties: Party[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            সবচেয়ে বেশি পাওনা
          </CardTitle>
          <Link href="/app/parties?type=customer" className="text-[11px] text-indigo-600 flex items-center gap-0.5 hover:underline">
            সব দেখুন <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {parties.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">কোনো পাওনা নেই</p>
        ) : (
          parties.map(p => (
            <PartyRow key={p.id} party={p} actionType="payment_in" actionLabel="টাকা নিন" />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TopPayables({ parties }: { parties: Party[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-orange-800 flex items-center gap-2">
            <Truck className="h-4 w-4 text-orange-500" />
            সবচেয়ে বেশি দেনা
          </CardTitle>
          <Link href="/app/parties?type=supplier" className="text-[11px] text-indigo-600 flex items-center gap-0.5 hover:underline">
            সব দেখুন <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {parties.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">কোনো দেনা নেই</p>
        ) : (
          parties.map(p => (
            <PartyRow key={p.id} party={p} actionType="payment_out" actionLabel="টাকা দিন" />
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ─── Closing Variance Card ───────────────────────────────────────────────────

function ClosingHistory({ closings }: { closings: Closing[] }) {
  if (!closings.length) return null

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-slate-800">শেষ ৭টি ক্লোজিং</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ClosingVarianceStrip closings={closings} />
        <p className="text-[10px] text-slate-400 mt-2">সবুজ = ঠিকঠাক · হলুদ = সামান্য গরমিল · লাল = বড় পার্থক্য</p>
      </CardContent>
    </Card>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function MoneyVisibility() {
  const res = await getMoneyVisibility({})
  if (!res?.success || !res.data) return null

  const d = res.data as {
    accounts:     Account[]
    top_debtors:  Party[]
    top_payables: Party[]
    profit_trend: ProfitDay[]
    closings:     Closing[]
  }

  return (
    <div className="space-y-4 mt-2">
      <CashBreakdown accounts={d.accounts ?? []} />
      {(d.profit_trend?.length ?? 0) > 0 && (
        <ProfitTrend data={d.profit_trend} />
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <TopDebtors  parties={d.top_debtors  ?? []} />
        <TopPayables parties={d.top_payables ?? []} />
      </div>
      {(d.closings?.length ?? 0) > 0 && (
        <ClosingHistory closings={d.closings} />
      )}
    </div>
  )
}

export function MoneyVisibilitySkeleton() {
  return (
    <div className="space-y-4 mt-2 animate-pulse">
      <div className="h-24 bg-slate-100 rounded-xl" />
      <div className="h-40 bg-slate-100 rounded-xl" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
