import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  try {
    const results = {
      renewed: 0,
      canceled: 0,
      past_due: 0,
      suspended: 0,
      errors: [] as string[],
    }

    // ── Step 1: Renewals ──────────────────────────────────────
    // Subscriptions whose billing period has ended.
    const { data: endedSubs, error: endedSubsError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('status', 'active')
      .lte('current_period_end', now)

    if (endedSubsError) throw endedSubsError

    for (const sub of endedSubs ?? []) {
      try {
        if (sub.cancel_at_period_end) {
          await supabase
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: now })
            .eq('id', sub.id)
          results.canceled++
          continue
        }

        const nextPlanId   = sub.scheduled_plan_id ?? sub.plan_id
        const nextPlan     = sub.scheduled_plan_id
          ? (await supabase.from('plans').select('price_monthly').eq('id', nextPlanId).single()).data
          : sub.plans
        const amountToBill = nextPlan?.price_monthly ?? 0

        // Advance the billing period so this sub is not picked up again next run.
        const newPeriodStart = new Date(sub.current_period_end)
        const newPeriodEnd   = new Date(sub.current_period_end)
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

        if (amountToBill === 0) {
          // Free plan — auto-renew immediately with no invoice required
          await supabase
            .from('subscriptions')
            .update({
              plan_id:               nextPlanId,
              status:                'active',
              current_period_start:  newPeriodStart.toISOString(),
              current_period_end:    newPeriodEnd.toISOString(),
              scheduled_plan_id:     null,
              updated_at:            now,
            })
            .eq('id', sub.id)
          results.renewed++
          continue
        }

        // Paid plan — create an open invoice and advance the period.
        // Advancing the period now means the subscription keeps working
        // (grace period) until the invoice overdue logic below kicks in.
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            business_id:          sub.business_id,
            subscription_id:      sub.id,
            amount_due:           amountToBill,
            status:               'open',
            due_date:             new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            billing_period_start: newPeriodStart.toISOString(),
            billing_period_end:   newPeriodEnd.toISOString(),
          })

        if (invoiceError) throw invoiceError

        await supabase
          .from('subscriptions')
          .update({
            plan_id:               nextPlanId,
            current_period_start:  newPeriodStart.toISOString(),
            current_period_end:    newPeriodEnd.toISOString(),
            scheduled_plan_id:     null,
            updated_at:            now,
          })
          .eq('id', sub.id)

        results.renewed++
      } catch (err: any) {
        results.errors.push(`Renewal error sub ${sub.id}: ${err.message}`)
      }
    }

    // ── Step 2: Past Due ──────────────────────────────────────
    // Open invoices whose due_date passed 3 days ago.
    // Querying invoices (not period_end) so it works correctly after
    // step 1 has already advanced current_period_end.
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('subscription_id')
      .eq('status', 'open')
      .lte('due_date', threeDaysAgo)

    const pastDueSubIds = [...new Set(
      (overdueInvoices ?? []).map(i => i.subscription_id).filter(Boolean)
    )]

    if (pastDueSubIds.length > 0) {
      const { data: updated } = await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: now })
        .in('id', pastDueSubIds)
        .eq('status', 'active')
        .select('id')

      results.past_due += updated?.length ?? 0
    }

    // ── Step 3: Suspend ───────────────────────────────────────
    // Open invoices whose due_date passed 7 days ago → suspend the
    // subscription AND the business so the middleware blocks access.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expiredInvoices } = await supabase
      .from('invoices')
      .select('subscription_id, subscriptions!inner(business_id)')
      .eq('status', 'open')
      .lte('due_date', sevenDaysAgo)

    const suspendSubIds: string[]  = []
    const suspendBizIds: string[]  = []

    for (const inv of expiredInvoices ?? []) {
      if (inv.subscription_id) suspendSubIds.push(inv.subscription_id)
      const bizId = (inv.subscriptions as any)?.business_id
      if (bizId) suspendBizIds.push(bizId)
    }

    const uniqueSubIds = [...new Set(suspendSubIds)]
    const uniqueBizIds = [...new Set(suspendBizIds)]

    if (uniqueSubIds.length > 0) {
      const { data: suspendedSubs } = await supabase
        .from('subscriptions')
        .update({ status: 'suspended', updated_at: now })
        .in('id', uniqueSubIds)
        .in('status', ['active', 'past_due'])
        .select('id')

      results.suspended += suspendedSubs?.length ?? 0
    }

    // Cascade: suspended subscription → suspended business
    if (uniqueBizIds.length > 0) {
      await supabase
        .from('businesses')
        .update({ status: 'suspended', updated_at: now })
        .in('id', uniqueBizIds)
        .eq('status', 'active')
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cron billing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
