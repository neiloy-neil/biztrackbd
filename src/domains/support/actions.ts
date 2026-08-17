'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logPlatformAction } from '@/lib/security/audit'
import { revalidatePath } from 'next/cache'

// ==========================================
// TENANT ACTIONS
// ==========================================

export async function createTicket(businessId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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
}

// ==========================================
// ADMIN ACTIONS
// ==========================================

async function getAdminSupabase() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: adminData } = await supabase.from('platform_admins').select('role').eq('user_id', user.id).single()
  if (!adminData) throw new Error('Unauthorized')

  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const adminSupabase = await getAdminSupabase()

  const { error } = await adminSupabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId)
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
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  const adminSupabase = await getAdminSupabase()

  const { error } = await adminSupabase.from('support_tickets').update({ assigned_to: assigneeId, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(error.message)

  await logPlatformAction({
    action: 'assign_ticket',
    target_type: 'ticket',
    target_id: ticketId,
    new_state: { assigned_to: assigneeId }
  })

  revalidatePath(`/admin/support/${ticketId}`)
}

export async function adminReplyToTicket(ticketId: string, message: string, isInternalNote: boolean, attachmentUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  const adminSupabase = await getAdminSupabase()

  const { error } = await adminSupabase.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: user.id,
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
    await adminSupabase.from('support_tickets').update({ status: 'Waiting for customer', updated_at: new Date().toISOString() }).eq('id', ticketId)
  }

  revalidatePath(`/admin/support/${ticketId}`)
  if (!isInternalNote) {
    revalidatePath(`/app/support/${ticketId}`)
  }
}
