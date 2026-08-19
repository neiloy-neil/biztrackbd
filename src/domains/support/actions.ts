'use server'

import { createClient } from '@/lib/supabase/server'
import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'

import { logPlatformAction } from '@/lib/security/audit'
import { revalidatePath } from 'next/cache'

// ==========================================
// TENANT ACTIONS
// ==========================================

export async function createTicket(businessId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single()
  if (!membership) throw new Error('Unauthorized')

  const subject = formData.get('subject') as string
  const category = formData.get('category') as string
  const priority = formData.get('priority') as string
  const message = formData.get('message') as string
  
  // Handled client-side before calling this action, or we pass the URL if already uploaded
  const attachmentUrl = formData.get('attachmentUrl') as string || null

  const { data: ticket, error: ticketError } = await supabase.from('support_tickets').insert({
    business_id: businessId,
    user_id: user.id,
    subject,
    category,
    priority,
    status: 'Open'
  }).select().single()

  if (ticketError) {
    console.error('Error creating ticket:', ticketError)
    throw new Error('Failed to create support ticket')
  }

  const { error: messageError } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    message,
    attachment_url: attachmentUrl,
    is_internal_note: false
  })

  if (messageError) {
    console.error('Error creating ticket message:', messageError)
    throw new Error('Ticket created but failed to add initial message')
  }

  revalidatePath(`/app/support`)
  return ticket.id
}

export async function replyToTicket(ticketId: string, message: string, attachmentUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('business_id')
    .eq('id', ticketId)
    .single()
  if (!ticket) throw new Error('Ticket not found')

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('business_id', ticket.business_id)
    .single()
  if (!membership) throw new Error('Unauthorized')

  const { error } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: user.id,
    message,
    attachment_url: attachmentUrl || null,
    is_internal_note: false
  })

  if (error) {
    console.error('Error replying to ticket:', error)
    throw new Error('Failed to reply to ticket')
  }

  revalidatePath(`/app/support/${ticketId}`)
  revalidatePath(`/admin/support/${ticketId}`)
  return { success: true, data: null }
}

// ==========================================
// ADMIN ACTIONS
// ==========================================



export const updateTicketStatus = adminAction(PLATFORM_PERMISSIONS.SUPPORT_MANAGE, async (params: { ticketId: string, status: string }, ctx: any) => {
  const { ticketId, status } = params
  const adminSupabase = ctx.adminClient

  const { error } = await ctx.adminClient.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'update_ticket_status',
    target_type: 'ticket',
    target_id: ticketId,
    new_state: { status }
  })

  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath(`/admin/support`)
  revalidatePath(`/app/support/${ticketId}`)
  return { success: true, data: null }
})

export const assignTicket = adminAction(PLATFORM_PERMISSIONS.SUPPORT_MANAGE, async (params: { ticketId: string, assigneeId: string | null }, ctx: any) => {
  const { ticketId, assigneeId } = params
  const adminSupabase = ctx.adminClient

  const { error } = await ctx.adminClient.from('support_tickets').update({ assigned_to: assigneeId, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'assign_ticket',
    target_type: 'ticket',
    target_id: ticketId,
    new_state: { assigned_to: assigneeId }
  })

  revalidatePath(`/admin/support/${ticketId}`)
  return { success: true, data: null }
})

export const resolveTicket = adminAction(PLATFORM_PERMISSIONS.SUPPORT_MANAGE, async (params: { ticketId: string }, ctx: any) => {
  const { ticketId } = params
  const { error } = await ctx.adminClient
    .from('support_tickets')
    .update({ status: 'Resolved' })
    .eq('id', ticketId)

  if (error) throw error

  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
  return { success: true, data: null }
})

export async function getSupportAttachmentUrl(path: string) {
  // Check admin context first
  const { createAdminAuthClient } = await import('@/domains/auth/admin-actions')
  const adminAuthClient = await createAdminAuthClient()
  const { data: { user: adminUser } } = await adminAuthClient.auth.getUser()

  if (adminUser) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase.storage
      .from('support-attachments')
      .createSignedUrl(path, 60)
    
    if (error || !data) {
      console.error('Failed to generate admin signed URL:', error)
      throw new Error('Failed to generate admin signed URL.')
    }
    return data.signedUrl
  }

  // Not an admin, try business user context
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(path, 60)

  if (error || !data) {
    console.error('Failed to generate signed URL:', error)
    throw new Error('You do not have permission to view this attachment.')
  }

  return data.signedUrl
}

export const uploadSupportAttachmentAdmin = adminAction<FormData, string>(PLATFORM_PERMISSIONS.SUPPORT_MANAGE, async (formData, ctx) => {
  const file = formData.get('file') as File
  if (!file) return { success: false, error: 'No file provided' }
  
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `admin/${ctx.userId}/${fileName}`

  const { error: uploadError } = await ctx.adminClient.storage
    .from('support-attachments')
    .upload(filePath, file)

  if (uploadError) return { success: false, error: uploadError.message }
  return { success: true, data: filePath }
})

export const adminReplyToTicket = adminAction(PLATFORM_PERMISSIONS.SUPPORT_MANAGE, async (params: { ticketId: string, message: string, isInternalNote: boolean, attachmentUrl?: string }, ctx: any) => {
  const { ticketId, message, isInternalNote, attachmentUrl } = params
  const { error } = await ctx.adminClient.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: ctx.userId,
    message,
    attachment_url: attachmentUrl || null,
    is_internal_note: isInternalNote
  })

  if (error) throw new Error(error.message)

  if (isInternalNote) {
    await logPlatformAction({
      action: 'add_internal_note',
      target_type: 'ticket',
      target_id: ticketId
    })
  } else {
    // Also update ticket status to "Waiting for customer" automatically if replying publicly
    await ctx.adminClient.from('support_tickets').update({ status: 'Waiting for customer', updated_at: new Date().toISOString() }).eq('id', ticketId)
  }

  revalidatePath(`/admin/support/${ticketId}`)
  if (!isInternalNote) {
    revalidatePath(`/app/support/${ticketId}`)
  }
  return { success: true, data: null }
})
