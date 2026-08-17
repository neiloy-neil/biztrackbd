import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { LogOut, Settings as SettingsIcon, Store, CreditCard, HeadphonesIcon, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLink as Link } from '@/components/AppLink'
import { cn } from '@/lib/utils'
import { LogoutButton } from '@/domains/auth/components/LogoutButton'
import { AccountsClient } from '@/domains/settings/components/AccountsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">সেটিংস (Settings)</h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="w-5 h-5 text-slate-500" /> ব্যবসা (Business)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 flex flex-col">
            <p className="text-sm text-slate-600 mb-2">আপনি বর্তমানে একটি ডেমো/সক্রিয় ব্যবসায় আছেন।</p>
            <Link href="/app/settings/business" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>ব্যবসার সেটিংস</Link>
            <Link href="/app/closing" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>হিসাব ক্লোজিং (Day Close)</Link>
            <Link href="/settings/profile" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>প্রোফাইল আপডেট</Link>
            <Link href="/settings/staff" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>স্টাফ ম্যানেজমেন্ট</Link>
            <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>রিপোর্টস (Reports)</Link>
            <Link href="/app/insights" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>স্মার্ট ইনসাইটস (Insights)</Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-500" /> অ্যাকাউন্ট (Accounts)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountsClient />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-500" /> পেমেন্ট ও সাবস্ক্রিপশন
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/settings/billing" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>সাবস্ক্রিপশন প্ল্যান</Link>
            <Button variant="outline" className="w-full justify-start">এসএমএস রেট (SMS Rate)</Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HeadphonesIcon className="w-5 h-5 text-slate-500" /> সাপোর্ট (Support)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/app/support" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>সাপোর্ট টিকেট (Support Tickets)</Link>
          </CardContent>
        </Card>

        <LogoutButton />
      </div>
    </div>
  )
}
