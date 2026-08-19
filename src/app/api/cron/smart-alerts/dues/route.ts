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
  
  // 2. Find businesses with SMS alerts enabled
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('enable_sms_alerts', true)
    .gt('sms_credits', 0)

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ message: 'No eligible businesses found' })
  }

  let smsSentCount = 0

  // 3. For each business, find customers with dues > 0
  // In a real scenario we'd check if the due is older than X days, 
  // but for now we just remind top debtors who have phones.
  for (const business of businesses) {
    const { data: debtors } = await supabase
      .from('parties')
      .select('id, name, phone, current_due')
      .eq('business_id', business.id)
      .in('type', ['customer', 'both'])
      .gt('current_due', 0)
      .not('phone', 'is', null)
      .limit(10) // Limit to 10 per run per business to avoid blowing through credits instantly

    if (debtors && debtors.length > 0) {
      for (const debtor of debtors) {
        if (!debtor.phone) continue
        
        const message = `Hello ${debtor.name}, your current due at ${business.name} is BDT ${debtor.current_due}. Please clear it soon.`
        
        // Use sender utility which also checks and deducts credits
        const result = await sendSms(debtor.phone, message, business.id)
        if (result.success) {
          smsSentCount++
        }
      }
    }
  }

  return NextResponse.json({ success: true, smsSentCount })
}
