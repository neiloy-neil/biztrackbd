'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, UploadCloud } from 'lucide-react'
import { createTicket } from '@/domains/support/actions'
import { createClient } from '@/lib/supabase/client'

export default function NewTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: member } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).single()
      if (!member) throw new Error('No business found')

      let attachmentUrl = null
      if (file) {
        setUploading(true)
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${member.business_id}/${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error('Failed to upload attachment: ' + uploadError.message)
        }

        const { data: urlData } = supabase.storage
          .from('support-attachments')
          .getPublicUrl(filePath) // Note: Since bucket is not public, we might need to use createSignedUrl, but for this demo getPublicUrl won't work perfectly for restricted buckets unless we rely on session cookies. We will just store the path and use it server-side or via signed URLs later.
        
        attachmentUrl = filePath // Store path instead of public URL
      }

      if (attachmentUrl) {
        formData.append('attachmentUrl', attachmentUrl)
      }

      const ticketId = await createTicket(member.business_id, formData)
      router.push(`/app/support/${ticketId}`)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/app/support" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Support Hub
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Support Ticket</h1>
        <p className="text-slate-500">Describe your issue in detail and we'll get back to you as soon as possible.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select 
                  id="category"
                  name="category"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">Select a category</option>
                  <option value="Billing">Billing & Subscription</option>
                  <option value="Login">Login & Access</option>
                  <option value="Transaction">Sales & Transactions</option>
                  <option value="Inventory">Inventory Management</option>
                  <option value="Bug">Report a Bug</option>
                  <option value="Feature request">Feature Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select 
                  id="priority"
                  name="priority"
                  required
                  defaultValue="Medium"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="Low">Low - General inquiry</option>
                  <option value="Medium">Medium - Non-critical issue</option>
                  <option value="High">High - Core functionality impaired</option>
                  <option value="Urgent">Urgent - Business blocked entirely</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input 
                id="subject"
                name="subject"
                placeholder="Brief summary of the issue..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Detailed Message</Label>
              <Textarea 
                id="message"
                name="message"
                placeholder="Please describe exactly what happened, including any error messages..."
                className="min-h-[150px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment (Optional)</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex justify-center items-center">
                <Input 
                  id="attachment"
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Label htmlFor="attachment" className="cursor-pointer flex flex-col items-center space-y-2 text-slate-500 hover:text-slate-700">
                  <UploadCloud className="w-8 h-8" />
                  <span className="text-sm font-medium">
                    {file ? file.name : 'Click to upload a screenshot or file'}
                  </span>
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/app/support">
                <Button type="button" variant="outline" disabled={loading}>Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploading ? 'Uploading...' : 'Submitting...'}
                  </>
                ) : (
                  'Submit Ticket'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
