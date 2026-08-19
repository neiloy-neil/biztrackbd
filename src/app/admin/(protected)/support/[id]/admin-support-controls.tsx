'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus, assignTicket } from '@/domains/support/actions'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSupportControls({ 
  ticketId, 
  currentStatus, 
  currentAssignee,
  adminUsers 
}: { 
  ticketId: string, 
  currentStatus: string, 
  currentAssignee: string | null,
  adminUsers: any[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [assignee, setAssignee] = useState(currentAssignee || '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      if (status !== currentStatus) {
        await updateTicketStatus({ ticketId, status })
      }
      if (assignee !== (currentAssignee || '')) {
        await assignTicket({ ticketId, assigneeId: assignee || null })
      }
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Failed to update ticket')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = status !== currentStatus || assignee !== (currentAssignee || '')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status</Label>
        <select 
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
        >
          <option value="Open">Open</option>
          <option value="In progress">In progress</option>
          <option value="Waiting for customer">Waiting for customer</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Assignee</Label>
        <select 
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
        >
          <option value="">Unassigned</option>
          {adminUsers.map(admin => (
            <option key={admin.id} value={admin.id}>{admin.email}</option>
          ))}
        </select>
      </div>

      <Button 
        onClick={handleSave} 
        disabled={!hasChanges || loading} 
        className="w-full mt-4"
        size="sm"
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Save Changes
      </Button>
    </div>
  )
}
