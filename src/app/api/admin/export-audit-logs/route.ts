import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { NextRequest, NextResponse } from 'next/server'
import { stringify } from 'csv-stringify/sync'

export async function GET(req: NextRequest) {
  const supabase = await createAdminAuthClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.audit.view' })
  if (!hasPermission) return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const actionFilter = searchParams.get('action') || ''

  let dbQuery = supabase
    .from('platform_audit_logs')
    .select('*, auth_users:actor_id(email)')
    .order('created_at', { ascending: false })

  if (query) {
    dbQuery = dbQuery.or(`target_id.ilike.%${query}%,action.ilike.%${query}%`)
  }
  if (actionFilter) {
    dbQuery = dbQuery.eq('action', actionFilter)
  }

  const { data: logs, error } = await dbQuery

  if (error) {
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  // Format data for CSV
  const csvData = (logs || []).map(log => ({
    Timestamp: new Date(log.created_at).toISOString(),
    ActorEmail: log.auth_users?.email || 'System',
    ActorId: log.actor_id,
    Action: log.action,
    TargetType: log.target_type,
    TargetId: log.target_id,
    NewState: JSON.stringify(log.new_state || {}),
    PreviousState: JSON.stringify(log.previous_state || {}),
    IPAddress: log.ip_address || '',
    UserAgent: log.user_agent || ''
  }))

  const csvString = stringify(csvData, { header: true })

  return new NextResponse(csvString, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`
    }
  })
}
