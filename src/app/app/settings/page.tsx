import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Settings as SettingsIcon,
  Store,
  CreditCard,
  HeadphonesIcon,
  Wallet,
  Users2,
  BarChart2,
  Sparkles,
  CalendarCheck,
  GitBranch,
  Building2,
  ChevronRight,
  Truck,
  Globe
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AppLink as Link } from '@/components/AppLink'
import { LogoutButton } from '@/domains/auth/components/LogoutButton'
import { AccountsClient } from '@/domains/settings/components/AccountsClient'
import { BranchClient } from '@/domains/settings/components/BranchClient'

const navTiles = [
  {
    href: '/app/settings/storefront',
    label: 'অনলাইন স্টোর',
    sub: 'Online Store',
    icon: Globe,
    color: 'blue',
  },
  {
    href: '/app/settings/integrations',
    label: 'কুরিয়ার',
    sub: 'Courier Setup',
    icon: Truck,
    color: 'orange',
  },
  {
    href: '/app/settings/business',
    label: 'ব্যবসার প্রোফাইল',
    sub: 'Business Profile',
    icon: Store,
    color: 'emerald',
  },
  {
    href: '/app/settings/staff',
    label: 'স্টাফ ম্যানেজমেন্ট',
    sub: 'Staff Management',
    icon: Users2,
    color: 'orange',
  },
  {
    href: '/app/closing',
    label: 'হিসাব ক্লোজিং',
    sub: 'Day Close',
    icon: CalendarCheck,
    color: 'purple',
  },
  {
    href: '/app/reports',
    label: 'রিপোর্টস',
    sub: 'Reports',
    icon: BarChart2,
    color: 'teal',
  },
  {
    href: '/app/insights',
    label: 'স্মার্ট ইনসাইটস',
    sub: 'Insights',
    icon: Sparkles,
    color: 'blue',
  },
  {
    href: '/app/support',
    label: 'সাপোর্ট টিকেট',
    sub: 'Support',
    icon: HeadphonesIcon,
    color: 'slate',
  },
] as const

const tileColors: Record<string, string> = {
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 [--icon-bg:theme(colors.emerald.100)] [--icon-color:theme(colors.emerald.600)] [--sub-color:theme(colors.emerald.500)]',
  orange:  'bg-orange-50  border-orange-100  text-orange-700  hover:bg-orange-100  [--icon-bg:theme(colors.orange.100)]  [--icon-color:theme(colors.orange.600)]  [--sub-color:theme(colors.orange.500)]',
  purple:  'bg-purple-50  border-purple-100  text-purple-700  hover:bg-purple-100  [--icon-bg:theme(colors.purple.100)]  [--icon-color:theme(colors.purple.600)]  [--sub-color:theme(colors.purple.500)]',
  teal:    'bg-teal-50    border-teal-100    text-teal-700    hover:bg-teal-100    [--icon-bg:theme(colors.teal.100)]    [--icon-color:theme(colors.teal.600)]    [--sub-color:theme(colors.teal.500)]',
  blue:    'bg-blue-50    border-blue-100    text-blue-700    hover:bg-blue-100    [--icon-bg:theme(colors.blue.100)]    [--icon-color:theme(colors.blue.600)]    [--sub-color:theme(colors.blue.500)]',
  slate:   'bg-slate-100  border-slate-200   text-slate-700   hover:bg-slate-200   [--icon-bg:theme(colors.slate.200)]   [--icon-color:theme(colors.slate.600)]   [--sub-color:theme(colors.slate.500)]',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value
  let businessName = 'আপনার ব্যবসা'
  if (businessId) {
    const { data } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single()
    if (data?.name) businessName = data.name
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">

      {/* Page title */}
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">সেটিংস</h2>
      </div>

      <div className="space-y-4 max-w-lg">

        {/* Business profile header card */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-900 truncate">{businessName}</p>
                <p className="text-sm text-slate-500 truncate">{user.email}</p>
              </div>
              <Link
                href="/app/settings/business"
                className="text-sm text-emerald-600 font-medium shrink-0 hover:text-emerald-700"
              >
                সম্পাদনা →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick navigation grid */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700">দ্রুত নেভিগেশন</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-2 gap-3">
              {navTiles.map((tile) => {
                const Icon = tile.icon
                const colorCls = tileColors[tile.color]
                return (
                  <Link
                    key={tile.href}
                    href={tile.href}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-colors active:scale-95 ${colorCls}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--icon-bg)]">
                      <Icon className="w-5 h-5 text-[var(--icon-color)]" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold leading-tight">{tile.label}</div>
                      <div className="text-[11px] mt-0.5 text-[var(--sub-color)]">{tile.sub}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Accounts section */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-500" />
              <span>অ্যাকাউন্ট</span>
              <span className="text-sm font-normal text-slate-400 ml-1">— নগদ, ব্যাংক ও মোবাইল ব্যাংকিং</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountsClient />
          </CardContent>
        </Card>

        {/* Branches section */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-500" />
              <span>ব্রাঞ্চ</span>
              <span className="text-sm font-normal text-slate-400 ml-1">— আউটলেট ও শাখা ব্যবস্থাপনা</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BranchClient />
          </CardContent>
        </Card>

        {/* Billing + Support combined card */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700">আরও সেটিংস</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-4 space-y-2">
            <Link
              href="/app/settings/billing"
              className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-purple-800">সাবস্ক্রিপশন ও বিলিং</div>
                <div className="text-xs text-purple-500 mt-0.5">প্ল্যান, পেমেন্ট ও ব্যবহারের বিবরণ</div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />
            </Link>

            <Link
              href="/app/support"
              className="flex items-center gap-3 p-4 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                <HeadphonesIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">সাপোর্ট</div>
                <div className="text-xs text-slate-500 mt-0.5">সাহায্য ও সাপোর্ট টিকেট</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </Link>
          </CardContent>
        </Card>

        {/* Logout */}
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-400 text-center mb-3 uppercase tracking-wide">অ্যাকাউন্ট</p>
          <LogoutButton />
        </div>

      </div>
    </div>
  )
}
