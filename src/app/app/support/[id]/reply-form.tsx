'use client'

import { useState } from 'react'
import { replyToTicket } from '@/domains/support/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function TicketReplyForm({ ticketId, businessId, userId }: { ticketId: string, businessId: string, userId: string }) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    setLoading(true)
    try {
      let attachmentUrl = null
      if (file) {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${businessId}/${userId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(filePath, file)

        if (uploadError) throw uploadError
        attachmentUrl = filePath
      }

      await replyToTicket(ticketId, message, attachmentUrl || undefined)
      setMessage('')
      setFile(null)
    } catch (err) {
      console.error(err)
      alert('Failed to send reply')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 border-t pt-6">
      <div className="space-y-4">
        <Textarea 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your reply here..."
          className="min-h-[100px]"
          required
        />
        <div className="flex items-center justify-between">
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
            >
              <Paperclip className="w-4 h-4 mr-2" />
              {file ? file.name : 'Attach File'}
            </Button>
            {file && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)} className="text-red-500">
                Remove
              </Button>
            )}
          </div>
          <Button type="submit" disabled={loading || !message.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Send Reply
          </Button>
        </div>
      </div>
    </form>
  )
}
