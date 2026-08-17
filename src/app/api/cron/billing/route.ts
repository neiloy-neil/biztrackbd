import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // In production, you would want to secure this endpoint (e.g. check an Authorization header or Vercel Cron header)
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const results = {
      renewed: 0,
      canceled: 0,
      past_due: 0,
      suspended: 0,
      errors: [] as string[]
    }

    // 1. Process Ended Subscriptions (Renewals, Downgrades, Cancellations)
    // Find active subscriptions where the period has ended
    const { data: endedSubs, error: endedSubsError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('status', 'active')
      .lte('current_period_end', now)

    if (endedSubsError) throw endedSubsError

    for (const sub of (endedSubs || [])) {
      try {
        if (sub.cancel_at_period_end) {
          // Process Cancellation
          await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
          results.canceled++
        } else {
          // Process Renewal or Downgrade
          let nextPlanId = sub.plan_id
          let amountToBill = sub.plans.price_monthly

          // If there's a scheduled downgrade, apply it
          if (sub.scheduled_plan_id) {
            nextPlanId = sub.scheduled_plan_id
            const { data: newPlan } = await supabase.from('plans').select('price_monthly').eq('id', nextPlanId).single()
            if (newPlan) {
              amountToBill = newPlan.price_monthly
            }
          }

          // Generate new invoice
          const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
            business_id: sub.business_id,
            subscription_id: sub.id,
            amount_due: amountToBill,
            status: 'draft',
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days to pay
          }).select().single()

          if (invoiceError) throw invoiceError

          // If the amount to bill is 0 (e.g. Free plan), automatically mark paid and renew
          if (amountToBill === 0 || amountToBill === 0.0) {
            await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id)
            
            const periodStart = new Date(sub.current_period_end)
            const periodEnd = new Date(sub.current_period_end)
            periodEnd.setMonth(periodEnd.getMonth() + 1)

            await supabase.from('subscriptions').update({
              plan_id: nextPlanId,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              scheduled_plan_id: null
            }).eq('id', sub.id)
          } else {
            // Keep subscription active, but since period_end is in the past, they are technically in grace period
            // If they don't pay within 3 days, step 2 will catch them.
            if (sub.scheduled_plan_id) {
               // Update to the new plan id immediately, even if unpaid, so features restrict
               await supabase.from('subscriptions').update({
                 plan_id: nextPlanId,
                 scheduled_plan_id: null
               }).eq('id', sub.id)
            }
          }
          
          results.renewed++
        }
      } catch (err: any) {
        results.errors.push(`Error processing sub ${sub.id}: ${err.message}`)
      }
    }

    // 2. Process Past Due (Grace Period Expired)
    // Find active subscriptions where current_period_end is > 3 days ago
    const { data: pastDueSubs, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id, business_id')
      .eq('status', 'active')
      .lte('current_period_end', threeDaysAgo)

    if (pastDueError) throw pastDueError

    for (const sub of (pastDueSubs || [])) {
       await supabase.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id)
       results.past_due++
    }

    // 3. Process Suspensions (Past Due for > 7 days)
    const { data: suspendedSubs, error: suspError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'past_due')
      .lte('current_period_end', sevenDaysAgo)

    if (suspError) throw suspError

    for (const sub of (suspendedSubs || [])) {
       await supabase.from('subscriptions').update({ status: 'suspended' }).eq('id', sub.id)
       results.suspended++
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cron billing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
