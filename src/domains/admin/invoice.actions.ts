'use server'

import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'
import { revalidatePath } from 'next/cache'
import { logPlatformAction } from '@/lib/security/audit'

export const voidInvoiceAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { invoiceId: string }, ctx: any) => {
  const supabase = ctx.adminClient

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
  return { success: true, data: null }
})

export const refundInvoiceAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { invoiceId: string }, ctx: any) => {
  const supabase = ctx.adminClient

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
  return { success: true, data: null }
})

export const markInvoicePaidAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { invoiceId: string }, ctx: any) => {
  const supabase = ctx.adminClient

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
  return { success: true, data: null }
})
