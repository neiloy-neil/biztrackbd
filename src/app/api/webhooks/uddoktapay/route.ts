import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  // ── 1. Signature verification ──────────────────────────────
  const apiKey = req.headers.get('RT-UDDOKTAPAY-API-KEY')
  if (!apiKey || apiKey !== process.env.UDDOKTAPAY_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, any>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { invoice_id, status, amount, metadata } = payload

  if (!invoice_id || !status) {
    return NextResponse.json({ error: 'Missing invoice_id or status' }, { status: 400 })
  }

  // extract our internal invoice ID from metadata
  const internalInvoiceId = metadata?.invoice_id

  if (!internalInvoiceId) {
    console.error('Webhook missing internal invoice_id in metadata', payload)
    // Return 200 so UddoktaPay stops retrying (we can't process it anyway)
    return NextResponse.json({ received: true, reason: 'missing_internal_invoice_id' })
  }

  
  // ── 1.5. Payment Failure Alert ──────────────────────────
  if (status === 'CANCELED' || status === 'FAILED') {
    if (metadata?.business_id) {
      await supabaseAdmin.from('notifications').insert({
        business_id: metadata.business_id,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your recent payment attempt for invoice ${internalInvoiceId} has failed or was cancelled.`,
        reference_id: internalInvoiceId
      });
      // Admin notification
      await supabaseAdmin.from('platform_notifications').insert({
        type: 'payment_failed',
        priority: 'high',
        title: 'Payment Failed',
        message: `Business payment failed for invoice ${internalInvoiceId}.`,
        metadata: { business_id: metadata.business_id, invoice_id: internalInvoiceId }
      });
    }
  }

  // ── 2. Process webhook via BillingService ───────────
  try {
    const { BillingService } = await import('@/domains/billing/service')
    const billingService = new BillingService()
    const webhookSecret = process.env.WEBHOOK_SECRET
    const result = await billingService.processPaymentWebhook(invoice_id, metadata, webhookSecret)

    if (!result.success) {
      console.error('Webhook processing failed:', result.reason)
      return NextResponse.json({ received: true, reason: result.reason })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook service error:', error)
    return NextResponse.json({ error: 'Processing failed', message: error.message }, { status: 500 })
  }
}
