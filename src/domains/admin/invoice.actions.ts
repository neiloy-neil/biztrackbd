'use server'

import { adminAction } from '@/lib/auth-wrappers'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'

export const voidInvoiceAction = adminAction('platform.billing.manage', async (params: { invoiceId: string }) => {
  const supabase = await createClient()

  const { error } = await supabase.rpc('void_saas_invoice', {
    p_invoice_id: params.invoiceId
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'void_invoice',
    target_type: 'invoice',
    target_id: params.invoiceId,
    new_state: { status: 'void' }
  })

  revalidatePath(`/admin/invoices/${params.invoiceId}`)
  revalidatePath('/admin/invoices')
  return { success: true }
})

export const refundInvoiceAction = adminAction('platform.billing.manage', async (params: { invoiceId: string }) => {
  const supabase = await createClient()

  const { error } = await supabase.rpc('refund_saas_invoice', {
    p_invoice_id: params.invoiceId
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'refund_invoice',
    target_type: 'invoice',
    target_id: params.invoiceId,
    new_state: { status: 'refunded' }
  })

  revalidatePath(`/admin/invoices/${params.invoiceId}`)
  revalidatePath('/admin/invoices')
  return { success: true }
})

export const markInvoicePaidAction = adminAction('platform.billing.manage', async (params: { invoiceId: string }) => {
  const supabase = await createClient()

  const { error } = await supabase.rpc('mark_saas_invoice_paid', {
    p_invoice_id: params.invoiceId
  })

  if (error) return { success: false, error: error.message }

  await logPlatformAction({
    action: 'mark_invoice_paid',
    target_type: 'invoice',
    target_id: params.invoiceId,
    new_state: { status: 'paid' }
  })

  revalidatePath(`/admin/invoices/${params.invoiceId}`)
  revalidatePath('/admin/invoices')
  return { success: true }
})
