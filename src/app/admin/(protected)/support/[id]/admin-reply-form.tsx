'use client'

import { useState } from 'react'
import { adminReplyToTicket } from '@/domains/support/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Paperclip, Lock, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function AdminTicketReplyForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [isInternal, setIsInternal] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    setLoading(true)
    try {
      let attachmentUrl = null
      if (file) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `admin/${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(filePath, file)

        if (uploadError) throw uploadError
        attachmentUrl = filePath
      }

      await adminReplyToTicket(ticketId, message, isInternal, attachmentUrl || undefined)
      setMessage('')
      setFile(null)
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to send reply: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t">
      <div className="space-y-4">
        <div className={`p-1 rounded-lg ${isInternal ? 'bg-amber-50 border border-amber-200' : ''}`}>
          <Textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isInternal ? "Type an internal note (customer won't see this)..." : "Type a reply to the customer..."}
            className={`min-h-[120px] ${isInternal ? 'bg-transparent border-none focus-visible:ring-0 shadow-none placeholder:text-amber-700/50' : ''}`}
            required
          />
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-md border">
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch 
                id="internal-mode" 
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              <Label htmlFor="internal-mode" className="flex items-center gap-1.5 cursor-pointer">
                {isInternal ? <Lock className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-500" />}
                <span className={isInternal ? "text-amber-700 font-medium" : "text-slate-600"}>
                  Internal Note
                </span>
              </Label>
            </div>
            
            <div className="h-4 w-px bg-slate-300"></div>

            <div className="flex items-center gap-2">
              <input 
                type="file" 
                id="reply-file" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('reply-file')?.click()}
                className="h-8"
              >
                <Paperclip className="w-3.5 h-3.5 mr-2" />
                {file ? file.name : 'Attach File'}
              </Button>
              {file && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)} className="h-8 text-red-500">
                  Remove
                </Button>
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading || !message.trim()} className={isInternal ? "bg-amber-600 hover:bg-amber-700" : ""}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isInternal ? "Add Note" : "Send Reply"}
          </Button>
        </div>
      </div>
    </form>
  )
}
