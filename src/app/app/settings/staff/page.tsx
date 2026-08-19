import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLink as Link } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'
import { getStaffList } from '@/domains/settings/actions'
import { StaffClient } from '@/domains/settings/components/StaffClient'

export default async function StaffManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const res = await getStaffList()
  const staffMembers = res?.success && res.data ? res.data : []

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4">
        <Link href="/app/settings" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-slate-700" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">স্টাফ ম্যানেজমেন্ট</h2>
        </div>
      </div>

      <div className="space-y-4 max-w-2xl">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-800">
              <ShieldAlert className="w-5 h-5" /> রোল ভিত্তিক এক্সেস (RBAC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-emerald-700">
              আপনার প্রতিষ্ঠানে কর্মীদের জন্য রোল অ্যাসাইন করুন (Owner, Manager, Cashier, Staff)। 
              সিস্টেম স্বয়ংক্রিয়ভাবে তাদের এক্সেস নিয়ন্ত্রণ করবে।
            </p>
          </CardContent>
        </Card>

        <StaffClient initialStaff={staffMembers} />
      </div>
    </div>
  )
}
