import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, Settings, AlertTriangle, Info, AlertOctagon, CheckCircle2 } from 'lucide-react'
import { MarkReadButton, MarkAllReadButton, DeleteNotificationButton } from './notification-actions'
import { formatDistanceToNow } from 'date-fns'

export default async function AdminNotificationsPage({
  searchParams
}: {
  searchParams: { filter?: string, priority?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminData } = await supabase.from('platform_admins').select('*').eq('user_id', user.id).single()
  if (!adminData) redirect('/app/dashboard')

  const filter = searchParams.filter || 'unread'
  const priorityFilter = searchParams.priority || ''

  let dbQuery = supabase
    .from('platform_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  if (priorityFilter) {
    dbQuery = dbQuery.eq('priority', priorityFilter)
  }

  const { data: rawNotifications } = await dbQuery

  // Fetch read status for this specific admin
  const { data: reads } = await supabase
    .from('admin_notification_reads')
    .select('notification_id')
    .eq('admin_id', user.id)

  const readIds = new Set(reads?.map(r => r.notification_id) || [])

  let notifications = rawNotifications?.map(n => ({
    ...n,
    is_read: readIds.has(n.id)
  })) || []

  // Apply read/unread filter in memory
  if (filter === 'unread') {
    notifications = notifications.filter(n => !n.is_read)
  } else if (filter === 'read') {
    notifications = notifications.filter(n => n.is_read)
  }
  
  notifications = notifications.slice(0, 100)

  // Also fetch preferences to know if they muted anything
  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('muted_types')
    .eq('admin_id', user.id)
    .single()

  const mutedTypes = preferences?.muted_types || []

  // Filter out muted types ONLY IF they are not explicitly overriding via filter or if they are just viewing inbox
  // Actually, standard behavior: don't even create muted notifications, or just hide them here.
  // We'll hide them if they are muted.
  const visibleNotifications = notifications?.filter(n => !mutedTypes.includes(n.type)) || []

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertOctagon className="w-5 h-5 text-red-600" />
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'normal': return <Info className="w-5 h-5 text-blue-500" />
      case 'low': return <CheckCircle2 className="w-5 h-5 text-slate-400" />
      default: return <Bell className="w-5 h-5 text-slate-500" />
    }
  }

  const getPriorityClass = (priority: string, isRead: boolean) => {
    if (isRead) return 'bg-white text-slate-500'
    switch (priority) {
      case 'critical': return 'bg-red-50 text-red-900 border-l-4 border-red-600'
      case 'high': return 'bg-orange-50 text-orange-900 border-l-4 border-orange-500'
      case 'normal': return 'bg-blue-50 text-blue-900 border-l-4 border-blue-500'
      default: return 'bg-slate-50 text-slate-900 border-l-4 border-slate-400'
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Notifications</h1>
          <p className="text-slate-500">Monitor important system events and alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/notifications/preferences">
            <Button variant="outline" size="icon" title="Preferences">
              <Settings className="w-4 h-4 text-slate-600" />
            </Button>
          </Link>
          <MarkAllReadButton />
        </div>
      </div>

      <div className="flex items-center gap-4 border-b pb-4">
        <div className="flex gap-2">
          <Link href="/admin/notifications?filter=unread">
            <Badge variant={filter === 'unread' ? 'default' : 'secondary'} className="cursor-pointer">Unread</Badge>
          </Link>
          <Link href="/admin/notifications?filter=all">
            <Badge variant={filter === 'all' ? 'default' : 'secondary'} className="cursor-pointer">All</Badge>
          </Link>
          <Link href="/admin/notifications?filter=read">
            <Badge variant={filter === 'read' ? 'default' : 'secondary'} className="cursor-pointer">Read</Badge>
          </Link>
        </div>
        <div className="w-px h-4 bg-slate-300"></div>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/notifications?filter=${filter}&priority=`} className={`hover:underline ${!priorityFilter ? 'font-medium' : 'text-slate-500'}`}>Any Priority</Link>
          <Link href={`/admin/notifications?filter=${filter}&priority=critical`} className={`hover:underline ${priorityFilter === 'critical' ? 'font-medium text-red-600' : 'text-slate-500'}`}>Critical</Link>
          <Link href={`/admin/notifications?filter=${filter}&priority=high`} className={`hover:underline ${priorityFilter === 'high' ? 'font-medium text-orange-600' : 'text-slate-500'}`}>High</Link>
        </div>
      </div>

      <div className="space-y-3">
        {visibleNotifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            No notifications found.
          </div>
        ) : (
          visibleNotifications.map((notification: any) => (
            <Card key={notification.id} className={`transition-colors ${getPriorityClass(notification.priority, notification.is_read)}`}>
              <CardContent className="p-4 flex gap-4 items-start">
                <div className="mt-1 flex-shrink-0">
                  {getPriorityIcon(notification.priority)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-semibold ${notification.is_read ? 'text-slate-700' : ''}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-sm ${notification.is_read ? 'text-slate-500' : 'text-slate-700'}`}>
                    {notification.message}
                  </p>
                  
                  <div className="flex items-center gap-4 pt-2">
                    <Badge variant="outline" className="text-[10px] bg-white/50">{notification.type}</Badge>
                    {notification.target_url && (
                      <Link href={notification.target_url} className="text-xs text-indigo-600 hover:underline">
                        View Details &rarr;
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end pl-4 border-l border-slate-200/50">
                  <MarkReadButton id={notification.id} isRead={notification.is_read} />
                  <DeleteNotificationButton id={notification.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
