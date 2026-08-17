import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlusCircle, MessageSquare, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'

export default async function TenantSupportHub() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).single()
  if (!member) redirect('/app/dashboard')

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('business_id', member.business_id)
    .order('updated_at', { ascending: false })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <AlertCircle className="w-4 h-4 text-amber-500" />
      case 'In progress': return <Clock className="w-4 h-4 text-blue-500" />
      case 'Waiting for customer': return <MessageSquare className="w-4 h-4 text-purple-500" />
      case 'Resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'Closed': return <CheckCircle2 className="w-4 h-4 text-slate-400" />
      default: return null
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800 border-red-200'
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Low': return 'bg-slate-100 text-slate-800 border-slate-200'
      default: return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support Hub</h1>
          <p className="text-slate-500">Get help and track your ongoing support requests.</p>
        </div>
        <Link href="/app/support/new">
          <Button>
            <PlusCircle className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      </div>

      <Card>
        {tickets?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No Support Tickets</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              You haven't opened any support tickets yet. If you need help, feel free to create one!
            </p>
            <Link href="/app/support/new">
              <Button variant="outline">Create a Ticket</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets?.map(ticket => (
              <Link key={ticket.id} href={`/app/support/${ticket.id}`} className="block hover:bg-slate-50 transition-colors p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="font-medium text-slate-900 truncate max-w-md">{ticket.subject}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>#{ticket.id.split('-')[0]}</span>
                      <span>&bull;</span>
                      <span>{ticket.category}</span>
                      <span>&bull;</span>
                      <span>Updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant="secondary" className="font-normal bg-slate-100">
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
