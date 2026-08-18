import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SelectBusinessForm } from './SelectBusinessForm'

export default async function SelectBusinessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: members, error } = await supabase
    .from('business_members')
    .select('business_id, businesses!inner(name, status)')
    .eq('user_id', user.id)

  if (error || !members || members.length === 0) {
    redirect('/app/onboarding')
  }

  if (members.length === 1) {
    // If somehow they reached here with only 1 business, auto-redirect them
    // The SetCookie action will be triggered via form naturally if we just return a self-submitting form,
    // but the cleanest way is just to let them click it or we can handle it via server action.
  }

  const businesses = members.map(m => ({
    id: m.business_id,
    name: (m.businesses as any).name,
    status: (m.businesses as any).status
  }))

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Business</h1>
        <p className="mt-2 text-slate-500">Choose the workspace you want to log into.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl p-6 md:p-8">
        <SelectBusinessForm businesses={businesses} />
      </div>
    </div>
  )
}
