'use client'

import { markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '@/domains/admin/notifications'
import { Button } from '@/components/ui/button'
import { Check, CheckCircle2, Trash2 } from 'lucide-react'

export function MarkReadButton({ id, isRead }: { id: string, isRead: boolean }) {
  if (isRead) return null

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => markNotificationAsRead(id)}
      className="text-slate-500 hover:text-emerald-600"
      title="Mark as read"
    >
      <Check className="w-4 h-4" />
    </Button>
  )
}

export function MarkAllReadButton() {
  return (
    <Button 
      variant="outline" 
      onClick={() => markAllNotificationsAsRead()}
      className="gap-2"
    >
      <CheckCircle2 className="w-4 h-4" />
      Mark all as read
    </Button>
  )
}

export function DeleteNotificationButton({ id }: { id: string }) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => {
        if (confirm('Are you sure you want to delete this notification?')) {
          deleteNotification(id)
        }
      }}
      className="text-slate-400 hover:text-red-600"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )
}
