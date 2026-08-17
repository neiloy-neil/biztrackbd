'use client'

import { useState, useEffect } from 'react'
import { Bell, Package, AlertTriangle, Users, CheckCircle2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../actions'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const fetchNotifications = async () => {
    try {
      const res = await getUnreadNotifications()
      if (res?.success) {
        setNotifications(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRead = async (id: string, ref_id: string | null, type: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id))
      await markNotificationAsRead({ id })
      
      // Navigate based on type
      if (type === 'low_stock' && ref_id) {
        router.push(`/app/inventory`)
      } else if (type === 'overdue_due' && ref_id) {
        router.push(`/app/parties/${ref_id}`)
      } else {
        router.push(`/app/insights`)
      }
      
      setOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleReadAll = async () => {
    try {
      setNotifications([])
      await markAllNotificationsAsRead()
      setOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <Package className="h-4 w-4 text-amber-500" />
      case 'overdue_due': return <Users className="h-4 w-4 text-red-500" />
      case 'expense_spike': return <AlertTriangle className="h-4 w-4 text-purple-500" />
      default: return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative text-slate-600 hover:text-slate-900 focus:outline-none')}>
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 pb-2">
          <DropdownMenuLabel className="p-0 text-base font-bold">Notifications</DropdownMenuLabel>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReadAll} className="text-xs h-auto py-1 px-2 text-slate-500 hover:text-slate-900">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center justify-center space-y-2">
            <Bell className="h-8 w-8 text-slate-200" />
            <p>You're all caught up!</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className="flex items-start gap-3 p-4 cursor-pointer focus:bg-slate-50"
                onClick={() => handleRead(notif.id, notif.reference_id, notif.type)}
              >
                <div className="mt-0.5 rounded-full bg-slate-100 p-2">
                  {getIcon(notif.type)}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-900 leading-tight">
                    {notif.title}
                  </span>
                  <span className="text-sm text-slate-500 leading-snug line-clamp-2">
                    {notif.message}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
