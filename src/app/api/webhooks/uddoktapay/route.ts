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

  // ── 2. Atomic + idempotent processing via DB RPC ───────────
  // The RPC locks the invoice row with FOR UPDATE, checks whether
  // it is already paid (idempotent), then atomically updates the
  // invoice and advances the subscription period.
  const { data: result, error } = await supabaseAdmin.rpc('process_payment_webhook', {
    p_internal_invoice_id: internalInvoiceId,
    p_gateway_event_id:    invoice_id,
    p_status:              status,
    p_amount:              Number(amount) || 0,
  })

  if (error) {
    console.error('Webhook RPC error:', error)
    // Return 500 so UddoktaPay retries — the RPC is idempotent so retries are safe
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  const r = result as { ok: boolean; reason: string }

  if (!r.ok) {
    console.error('Webhook processing failed:', r)
    // Return 200 to stop retries for bad data (e.g. invoice not found)
    return NextResponse.json({ received: true, reason: r.reason })
  }

  return NextResponse.json({ received: true, reason: r.reason })
}
