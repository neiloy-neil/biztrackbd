import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, MessageSquare, Download, Lock, Building, Calendar } from 'lucide-react'
import AdminTicketReplyForm from './admin-reply-form'
import AdminSupportControls from './admin-support-controls'
import { SecureAttachmentButton } from '@/domains/support/components/secure-attachment-button'

export default async function AdminTicketPage({ params }: { params: { id: string } }) {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.support.view' })
  if (!hasPermission) redirect('/admin/dashboard')

  // Fetch ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .select('*, businesses(name, id, subscriptions(plans(name))), auth_users!support_tickets_user_id_fkey(email, id), assignee:support_tickets_assigned_to_fkey(email)')
    .eq('id', params.id)
    .single()

  if (ticketError || !ticket) {
    redirect('/admin/support')
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from('support_ticket_messages')
    .select('*, auth_users:sender_id(email, id)')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true })

  // Fetch all admins for assignee dropdown
  const { data: admins } = await supabase
    .from('platform_admins')
    .select('user_id, auth_users!platform_admins_user_id_fkey(email, id)')

  const adminUsers = admins?.map((a: any) => ({
    id: a.user_id,
    email: a.auth_users?.email
  })) || []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Link href="/admin/support" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Queue
      </Link>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Thread */}
        <div className="flex-1 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ticket.subject}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>Ticket #{ticket.id.split('-')[0]}</span>
              <span>&bull;</span>
              <span>{ticket.category}</span>
              <span>&bull;</span>
              <span>Priority: {ticket.priority}</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {messages?.map((msg: any) => {
                  const isAdminMsg = msg.sender_id !== ticket.user_id
                  return (
                    <div key={msg.id} className={`p-6 flex gap-4 ${msg.is_internal_note ? 'bg-amber-50/50' : isAdminMsg ? 'bg-indigo-50/30' : 'bg-white'}`}>
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${msg.is_internal_note ? 'bg-amber-100' : isAdminMsg ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                        {msg.is_internal_note ? (
                          <Lock className="w-5 h-5 text-amber-600" />
                        ) : (
                          <User className={`w-5 h-5 ${isAdminMsg ? 'text-indigo-600' : 'text-slate-600'}`} />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {msg.auth_users?.email || 'Unknown User'}
                            </span>
                            {msg.is_internal_note && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5">Internal Note</Badge>
                            )}
                            {isAdminMsg && !msg.is_internal_note && (
                              <Badge variant="secondary" className="text-[10px] h-5 bg-indigo-100 text-indigo-700">Staff</Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className={`whitespace-pre-wrap ${msg.is_internal_note ? 'text-amber-900' : 'text-slate-700'}`}>
                          {msg.message}
                        </div>
                        {msg.attachment_url && (
                          <div className="pt-2">
                            <SecureAttachmentButton path={msg.attachment_url} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="p-6 bg-slate-50 border-t rounded-b-lg">
                <AdminTicketReplyForm ticketId={ticket.id} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Context & Controls */}
        <div className="w-full lg:w-80 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ticket Controls</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <AdminSupportControls 
                ticketId={ticket.id} 
                currentStatus={ticket.status} 
                currentAssignee={ticket.assigned_to} 
                adminUsers={adminUsers} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Submitter
                </div>
                <div className="font-medium text-slate-900 break-all">{ticket.auth_users?.email}</div>
                <Link href={`/admin/users/${ticket.user_id}`} className="text-indigo-600 hover:underline text-xs">View User</Link>
              </div>
              
              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5" /> Business
                </div>
                <div className="font-medium text-slate-900">{ticket.businesses?.name}</div>
                <Link href={`/admin/businesses/${ticket.business_id}`} className="text-indigo-600 hover:underline text-xs">View Business</Link>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3">
                <div className="text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Created
                </div>
                <div className="font-medium text-slate-900">{new Date(ticket.created_at).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
