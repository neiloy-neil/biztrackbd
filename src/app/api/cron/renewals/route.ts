import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Protect the cron endpoint using a Bearer token or authorization header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('process_subscription_renewals')

    if (error) {
      console.error('Subscription renewal cron error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, results: data })
  } catch (error: any) {
    console.error('Subscription renewal cron exception:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
