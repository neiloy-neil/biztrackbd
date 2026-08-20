'use server'

import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'
import { logPlatformAction } from '@/lib/security/audit'
import { revalidatePath } from 'next/cache'

export const refundInvoiceAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { invoiceId: string, amount: number }, ctx: any) => {
  const { invoiceId, amount } = params
  
  // Create operation record
  const { error: opError } = await ctx.adminClient
    .from('platform_payment_operations')
    .insert({
      invoice_id: invoiceId,
      provider: 'manual',
      operation_type: 'refund',
      amount,
      status: 'completed'
    })
    
  if (opError) throw new Error(opError.message)

  // Mark invoice as refunded
  await ctx.adminClient.from('invoices').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', invoiceId)

  await logPlatformAction({
    action: 'refund_invoice',
    target_type: 'invoice',
    target_id: invoiceId,
    new_state: { status: 'refunded', refund_amount: amount }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const creditAccountAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { businessId: string, amount: number }, ctx: any) => {
  const { businessId, amount } = params
  
  const { error: opError } = await ctx.adminClient
    .from('platform_payment_operations')
    .insert({
      business_id: businessId,
      provider: 'manual',
      operation_type: 'credit',
      amount,
      status: 'completed'
    })
    
  if (opError) throw new Error(opError.message)

  await logPlatformAction({
    action: 'credit_account',
    target_type: 'business',
    target_id: businessId,
    new_state: { credit_amount: amount }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const cancelSubscriptionAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { subscriptionId: string }, ctx: any) => {
  const { subscriptionId } = params

  const { error } = await ctx.adminClient
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'cancel_subscription',
    target_type: 'subscription',
    target_id: subscriptionId,
    new_state: { status: 'cancelled' }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const extendSubscriptionAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { subscriptionId: string, days: number }, ctx: any) => {
  const { subscriptionId, days } = params

  const { data: sub, error: fetchErr } = await ctx.adminClient.from('subscriptions').select('current_period_end').eq('id', subscriptionId).single()
  if (fetchErr || !sub) throw new Error('Subscription not found')

  const newEndDate = new Date(sub.current_period_end)
  newEndDate.setDate(newEndDate.getDate() + days)

  const { error } = await ctx.adminClient
    .from('subscriptions')
    .update({ current_period_end: newEndDate.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'extend_subscription',
    target_type: 'subscription',
    target_id: subscriptionId,
    new_state: { current_period_end: newEndDate.toISOString() }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const changePlanAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { subscriptionId: string, newPlanId: string }, ctx: any) => {
  const { subscriptionId, newPlanId } = params

  const { error } = await ctx.adminClient
    .from('subscriptions')
    .update({ plan_id: newPlanId, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'change_subscription_plan',
    target_type: 'subscription',
    target_id: subscriptionId,
    new_state: { plan_id: newPlanId }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

export const toggleCancelAtPeriodEndAction = adminAction(PLATFORM_PERMISSIONS.BILLING_MANAGE, async (params: { subscriptionId: string, cancelAtPeriodEnd: boolean }, ctx: any) => {
  const { subscriptionId, cancelAtPeriodEnd } = params

  const { error } = await ctx.adminClient
    .from('subscriptions')
    .update({ cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'toggle_cancel_at_period_end',
    target_type: 'subscription',
    target_id: subscriptionId,
    new_state: { cancel_at_period_end: cancelAtPeriodEnd }
  })

  revalidatePath('/admin/billing')
  return { success: true, data: null }
})

