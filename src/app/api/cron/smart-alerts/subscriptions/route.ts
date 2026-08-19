import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms/sender'

// Runs daily via Vercel Cron
export async function GET(request: Request) {
  // 1. Verify cron secret
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  
  // 2. Find subscriptions expiring in exactly 3 days
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 3)
  const targetDateString = targetDate.toISOString().split('T')[0]

  const { data: subscriptions } = await supabase
    .from('business_subscriptions')
    .select('business_id, end_date')
    .eq('end_date', targetDateString)
    .eq('status', 'active')

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: 'No subscriptions expiring in 3 days' })
  }

  let smsSentCount = 0

  // 3. For each expiring subscription, find the owner's phone number and send alert
  for (const sub of subscriptions) {
    // Check if SMS alerts are enabled for this business
    const { data: business } = await supabase
      .from('businesses')
      .select('name, enable_sms_alerts, sms_credits')
      .eq('id', sub.business_id)
      .single()

    if (!business || !business.enable_sms_alerts || business.sms_credits <= 0) continue

    // Find the owner
    const { data: members } = await supabase
      .from('business_members')
      .select('user_id')
      .eq('business_id', sub.business_id)
      .eq('role', 'owner')
      .limit(1)

    if (members && members.length > 0) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(members[0].user_id)
      
      const phone = userRecord?.user?.user_metadata?.phone
      if (phone) {
        const message = `Alert: Your BizTrack BD subscription for ${business.name} expires in 3 days. Please renew to avoid service interruption.`
        const result = await sendSms(phone, message, sub.business_id)
        if (result.success) {
          smsSentCount++
        }
      }
    }
  }

  return NextResponse.json({ success: true, smsSentCount })
}
