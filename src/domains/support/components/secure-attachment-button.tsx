'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2 } from 'lucide-react'
import { getSupportAttachmentUrl } from '@/domains/support/actions'
import { toast } from 'sonner'

export function SecureAttachmentButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  // Extract just the filename for display if path exists
  const fileName = path.split('/').pop() || 'Attachment'

  const handleDownload = async () => {
    if (loading) return
    
    setLoading(true)
    try {
      const url = await getSupportAttachmentUrl(path)
      // Open the signed URL in a new tab to initiate download/view
      window.open(url, '_blank')
    } catch (error: any) {
      console.error('Failed to get attachment URL:', error)
      toast.error(error.message || 'Failed to download attachment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Badge 
      variant="outline" 
      className={`gap-1 cursor-pointer transition-colors ${loading ? 'opacity-70' : 'hover:bg-slate-100'}`}
      onClick={handleDownload}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Download className="w-3 h-3" />
      )}
      {fileName}
    </Badge>
  )
}
