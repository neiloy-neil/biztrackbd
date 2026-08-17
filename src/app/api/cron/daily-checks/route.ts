import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint is meant to be hit daily by a cron scheduler (like Vercel Cron or GitHub Actions)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  // Basic security: require a CRON_SECRET to execute
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Find subscriptions expiring in <= 3 days that are still 'active'
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    
    const { data: expiringSubs, error } = await supabase
      .from('subscriptions')
      .select('id, business_id, current_period_end, businesses(name)')
      .eq('status', 'active')
      .lte('current_period_end', threeDaysFromNow.toISOString())

    if (error) throw error

    if (expiringSubs && expiringSubs.length > 0) {
      // Create platform notifications for each
      const notifications = expiringSubs.map(sub => ({
        type: 'trial_expiring', // or 'subscription_expiring'
        priority: 'high',
        title: `Subscription Expiring: ${(sub.businesses as any)?.name || 'Unknown'}`,
        message: `Subscription for ${(sub.businesses as any)?.name || 'Unknown'} will expire on ${new Date(sub.current_period_end).toLocaleDateString()}.`,
        target_url: `/admin/businesses/${sub.business_id}`,
        metadata: { business_id: sub.business_id, subscription_id: sub.id }
      }))

      const { error: notifError } = await supabase
        .from('platform_notifications')
        .insert(notifications)

      if (notifError) throw notifError
    }

    return NextResponse.json({ success: true, processed: expiringSubs?.length || 0 })
  } catch (error: any) {
    console.error('Daily cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
