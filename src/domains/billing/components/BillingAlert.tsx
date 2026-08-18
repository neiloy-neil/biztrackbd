import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, Info, ArrowRight } from 'lucide-react'
import { PayRenewalButton } from './PayRenewalButton'

export async function BillingAlert({ businessId }: { businessId: string }) {
  const supabase = await createClient()

  // Find any open invoices
  const { data: openInvoice } = await supabase
    .from('invoices')
    .select('id, amount_due, status, due_date')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .order('due_date', { ascending: true })
    .limit(1)
    .single()

  // Check subscription status
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('business_id', businessId)
    .single()

  if (!openInvoice && sub?.status !== 'past_due' && sub?.status !== 'unpaid') {
    return null
  }

  // Determine alert type
  let title = 'Billing Notice'
  let message = ''
  let type: 'warning' | 'error' | 'info' = 'info'
  let showPayButton = !!openInvoice

  if (sub?.status === 'unpaid') {
    type = 'error'
    title = 'Subscription Suspended'
    message = 'Your subscription is unpaid and access has been suspended. Please pay the outstanding invoice to restore access.'
  } else if (sub?.status === 'past_due') {
    type = 'warning'
    title = 'Payment Past Due'
    message = 'Your subscription is past due. Please pay the outstanding invoice to avoid service interruption.'
  } else if (openInvoice) {
    type = 'info'
    title = 'Upcoming Renewal'
    message = `You have an upcoming subscription renewal invoice for ৳${openInvoice.amount_due} due on ${new Date(openInvoice.due_date).toLocaleDateString()}.`
  }

  const bgColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  }

  const iconColors = {
    info: 'text-blue-500',
    warning: 'text-orange-500',
    error: 'text-red-500',
  }

  return (
    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${bgColors[type]}`}>
      <div className="flex gap-3">
        {type === 'info' ? (
          <Info className={`w-6 h-6 shrink-0 mt-0.5 ${iconColors[type]}`} />
        ) : (
          <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${iconColors[type]}`} />
        )}
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm opacity-90 mt-1">{message}</p>
        </div>
      </div>
      
      {showPayButton && openInvoice && (
        <PayRenewalButton invoiceId={openInvoice.id} />
      )}
    </div>
  )
}
