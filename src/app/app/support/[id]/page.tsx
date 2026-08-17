import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, MessageSquare, Download } from 'lucide-react'
import TicketReplyForm from './reply-form'

export default async function TenantTicketPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).single()
  if (!member) redirect('/app/dashboard')

  // Fetch ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', params.id)
    .eq('business_id', member.business_id)
    .single()

  if (ticketError || !ticket) {
    redirect('/app/support')
  }

  // Fetch messages (RLS ensures internal notes are hidden from the tenant)
  const { data: messages } = await supabase
    .from('support_ticket_messages')
    .select('*, auth_users:sender_id(email, id)')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true })

  // Function to get temporary download URL for attachments
  const getAttachmentUrl = async (path: string) => {
    // If it's stored privately, create signed url. If public (which we avoided), just publicUrl.
    // For simplicity in this codebase, assuming we can get a signed URL:
    const { data } = await supabase.storage.from('support-attachments').createSignedUrl(path, 3600)
    return data?.signedUrl || '#'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/app/support" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Support Hub
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ticket.subject}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
            <span>Ticket #{ticket.id.split('-')[0]}</span>
            <span>&bull;</span>
            <span>{ticket.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ticket.priority} Priority</Badge>
          <Badge variant="secondary">{ticket.status}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {messages?.map((msg: any) => (
              <div key={msg.id} className={`p-6 flex gap-4 ${msg.sender_id === user.id ? 'bg-white' : 'bg-slate-50'}`}>
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${msg.sender_id === user.id ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                  <User className={`w-5 h-5 ${msg.sender_id === user.id ? 'text-indigo-600' : 'text-slate-600'}`} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900">
                      {msg.sender_id === user.id ? 'You' : 'Support Team'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap">
                    {msg.message}
                  </div>
                  {msg.attachment_url && (
                    <div className="pt-2">
                      {/* Using a client component or server action to handle secure download would be better, but we can render a link if signed URL generated */}
                      {/* For now, just show a badge */}
                      <Badge variant="outline" className="gap-1 cursor-pointer">
                        <Download className="w-3 h-3" />
                        Attachment Included
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {['Resolved', 'Closed'].includes(ticket.status) ? (
            <div className="p-6 bg-slate-50 border-t text-center text-slate-500 rounded-b-lg">
              This ticket is {ticket.status}. No further replies can be added.
            </div>
          ) : (
            <div className="p-6">
              <TicketReplyForm ticketId={ticket.id} businessId={member.business_id} userId={user.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
