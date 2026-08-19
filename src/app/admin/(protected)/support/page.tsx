import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Activity, User, Building, AlertCircle } from 'lucide-react'

export default async function AdminSupportQueue({
  searchParams
}: {
  searchParams: { q?: string, status?: string }
}) {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.support.view' })
  if (!hasPermission) redirect('/admin/dashboard')

  const query = searchParams.q || ''
  const statusFilter = searchParams.status || ''

  let dbQuery = supabase
    .from('support_tickets')
    .select('*, businesses(name), auth_users:user_id(email)')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (query) {
    dbQuery = dbQuery.or(`subject.ilike.%${query}%,id.ilike.%${query}%`)
  }
  if (statusFilter) {
    dbQuery = dbQuery.eq('status', statusFilter)
  }

  const { data: tickets } = await dbQuery

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support Queue</h1>
          <p className="text-slate-500">Manage support requests from all businesses.</p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-3" method="GET">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                name="q"
                defaultValue={query}
                placeholder="Search ticket ID or subject..." 
                className="pl-9 w-[250px]"
              />
            </div>
            <select 
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In progress">In progress</option>
              <option value="Waiting for customer">Waiting for customer</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Ticket ID</th>
                <th className="px-6 py-4 font-medium">Subject & Category</th>
                <th className="px-6 py-4 font-medium">Business / User</th>
                <th className="px-6 py-4 font-medium">Status & Priority</th>
                <th className="px-6 py-4 font-medium">Last Updated</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    No tickets found.
                  </td>
                </tr>
              ) : (
                tickets?.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      #{ticket.id.split('-')[0]}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 truncate max-w-[200px]" title={ticket.subject}>
                          {ticket.subject}
                        </span>
                        <span className="text-xs text-slate-500">{ticket.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-slate-900 font-medium">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{ticket.businesses?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{ticket.auth_users?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        <Badge variant="outline" className={
                          ticket.priority === 'Urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                          ticket.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          ticket.priority === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="secondary" className="font-normal bg-slate-100">
                          {ticket.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {new Date(ticket.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/support/${ticket.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          View & Reply
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
