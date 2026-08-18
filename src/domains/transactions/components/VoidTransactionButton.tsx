'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Ban } from 'lucide-react'
import { voidTransaction } from '../actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function VoidTransactionButton({ transactionId, state }: { transactionId: string, state: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)

  if (state === 'reversed') {
    return (
      <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-flex items-center gap-1">
        <Ban className="h-3 w-3" />
        Voided
      </span>
    )
  }

  const handleVoid = async () => {
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }

    setIsPending(true)
    const res = await voidTransaction({ 
      transaction_id: transactionId, 
      reason,
      idempotencyKey: crypto.randomUUID()
    })
    setIsPending(false)

    if (res?.success) {
      toast.success('Transaction voided successfully')
      setOpen(false)
    } else {
      toast.error(res?.error || 'Failed to void transaction')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
          <Ban className="h-4 w-4 mr-1.5" />
          Void
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to void this transaction? This action will restore inventory and reverse the financial impact. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Reason for voiding <span className="text-red-500">*</span></label>
          <Textarea 
            placeholder="E.g., Customer returned items, Entered by mistake..." 
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleVoid} disabled={isPending || !reason.trim()}>
            {isPending ? 'Voiding...' : 'Confirm Void'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
