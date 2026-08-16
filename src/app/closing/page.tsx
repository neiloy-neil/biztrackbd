import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClosingClient } from '@/domains/closing/components/ClosingClient'
import { getDailyClosingSummary } from '@/domains/closing/actions'
import { format } from 'date-fns'

export default async function ClosingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get today's date formatted as YYYY-MM-DD
  const today = format(new Date(), 'yyyy-MM-dd')
  
  // Fetch summary for today
  const res = await getDailyClosingSummary({ date: today })
  
  if (!res?.success) {
    return <div className="p-4 text-rose-500">Error loading closing summary: {res?.error}</div>
  }

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-24">
      <ClosingClient 
        today={today} 
        closingData={res.data} 
      />
    </div>
  )
}
