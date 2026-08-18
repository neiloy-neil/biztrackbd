import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Download, Search, Activity, User, Monitor } from 'lucide-react'
import Link from 'next/link'

// Note: This is a Server Component. 
// For real client-side export and dynamic filtering without page reloads, 
// we typically use a Client Component table. 
// For this implementation, we will use server-side searching via URL params.

export default async function PlatformAuditLogsPage({
  searchParams
}: {
  searchParams: { q?: string, action?: string, page?: string }
}) {
  const supabase = await createAdminAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // Check specific permission
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.audit.view' })
  if (!hasPermission) redirect('/admin/dashboard')

  const query = searchParams.q || ''
  const actionFilter = searchParams.action || ''
  
  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let dbQuery = supabase
    .from('platform_audit_logs')
    .select('*, auth_users:actor_id(email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (query) {
    dbQuery = dbQuery.or(`target_id.ilike.%${query}%,action.ilike.%${query}%`)
  }
  if (actionFilter) {
    dbQuery = dbQuery.eq('action', actionFilter)
  }

  const { data: logs, count, error } = await dbQuery
  const totalPages = count ? Math.ceil(count / pageSize) : 1

  // Derive unique actions for filter dropdown
  const { data: allActions } = await supabase.from('platform_audit_logs').select('action')
  const uniqueActions = Array.from(new Set(allActions?.map(a => a.action) || []))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Audit Logs</h1>
          <p className="text-slate-500">Append-only security and activity logs for Super Admins.</p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                name="q"
                defaultValue={query}
                placeholder="Search target ID or action..." 
                className="pl-9 w-[250px]"
              />
            </div>
            <select 
              name="action"
              defaultValue={actionFilter}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
          <Link href={`/api/admin/export-audit-logs?q=${encodeURIComponent(query)}&action=${encodeURIComponent(actionFilter)}`} className={buttonVariants({ variant: 'outline' })}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Link>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Actor</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Metadata</th>
                <th className="px-6 py-4 font-medium">Context (IP/UA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    No audit logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs?.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-indigo-600" />
                        </div>
                        <span className="font-medium text-slate-900">
                          {log.auth_users?.email || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="font-mono bg-slate-50">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{log.target_type}</span>
                        <span className="font-medium text-slate-900 truncate max-w-[150px]" title={log.target_id}>
                          {log.target_id || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.new_state && (
                        <pre className="text-[10px] bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto max-w-[200px]">
                          {JSON.stringify(log.new_state, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        {log.ip_address && (
                          <div className="flex items-center gap-1" title="IP Address">
                            <Monitor className="w-3 h-3" />
                            {log.ip_address}
                          </div>
                        )}
                        {log.user_agent && (
                          <div className="truncate max-w-[150px]" title={log.user_agent}>
                            {log.user_agent}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <div className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`?page=${page - 1}${query ? `&q=${query}` : ''}${actionFilter ? `&action=${actionFilter}` : ''}`}>
                  <Button variant="outline" size="sm">Previous</Button>
                </a>
              )}
              {page < totalPages && (
                <a href={`?page=${page + 1}${query ? `&q=${query}` : ''}${actionFilter ? `&action=${actionFilter}` : ''}`}>
                  <Button variant="outline" size="sm">Next</Button>
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
