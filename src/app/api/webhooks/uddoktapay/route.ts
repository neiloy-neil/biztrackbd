import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// We need a service role key here because webhooks are not authenticated by a user session
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const signature = req.headers.get('RT-UDDOKTAPAY-API-KEY')

    // Basic security check: Validate API key matches what we expect from Uddoktapay
    if (signature !== process.env.UDDOKTAPAY_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invoice_id, status, metadata } = payload
    
    // Validate we have the correct metadata (we should pass subscription_id or business_id when generating the link)
    if (!metadata || !metadata.subscription_id) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const subscriptionId = metadata.subscription_id

    // Update invoice state
    await supabaseAdmin
      .from('invoices')
      .update({ status: status === 'COMPLETED' ? 'paid' : 'unpaid' })
      .eq('uddoktapay_invoice_id', invoice_id)

    // Update subscription state
    if (status === 'COMPLETED') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ 
          status: 'active',
          // Assuming 1 month extension for simple monthly plan
          current_period_start: new Date().toISOString(),
          // Date math should ideally happen in DB via RPC, but this is a stub
        })
        .eq('id', subscriptionId)
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('id', subscriptionId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
