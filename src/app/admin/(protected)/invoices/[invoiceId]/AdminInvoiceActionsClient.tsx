'use client'

import { useState } from 'react'
import { Ban, CreditCard, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { voidInvoiceAction, refundInvoiceAction, markInvoicePaidAction } from '@/domains/admin/invoice.actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  invoiceId: string
  status: string
}

export function AdminInvoiceActionsClient({ invoiceId, status }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    action: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
  })

  const openConfirm = (title: string, description: string, actionFn: () => Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      action: actionFn
    })
  }

  const handleAction = async (actionId: string, actionFn: () => Promise<any>) => {
    setLoadingAction(actionId)
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    
    const res = await actionFn()
    if (!res?.success) {
      alert(`Action failed: ${res?.error || 'Unknown error'}`)
    }
    
    setLoadingAction(null)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {(status === 'open' || status === 'draft' || status === 'past_due') && (
          <>
            <Button 
              variant="outline" 
              className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
              disabled={loadingAction !== null}
              onClick={() => openConfirm(
                'Mark as Paid',
                'Are you sure you want to mark this invoice as paid manually?',
                () => handleAction('paid', () => markInvoicePaidAction({ invoiceId }))
              )}
            >
              <CheckCircle className="w-4 h-4" />
              {loadingAction === 'paid' ? 'Processing...' : 'Mark as Paid'}
            </Button>
            
            <Button 
              variant="outline" 
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              disabled={loadingAction !== null}
              onClick={() => openConfirm(
                'Void Invoice',
                'Are you sure you want to void this invoice? This action cannot be undone.',
                () => handleAction('void', () => voidInvoiceAction({ invoiceId }))
              )}
            >
              <Ban className="w-4 h-4" />
              {loadingAction === 'void' ? 'Processing...' : 'Void Invoice'}
            </Button>
          </>
        )}

        {status === 'paid' && (
          <Button 
            variant="outline" 
            className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
            disabled={loadingAction !== null}
            onClick={() => openConfirm(
              'Issue Refund',
              'Are you sure you want to mark this invoice as refunded? Make sure you have processed the actual refund on the payment gateway.',
              () => handleAction('refund', () => refundInvoiceAction({ invoiceId }))
            )}
          >
            <CreditCard className="w-4 h-4" />
            {loadingAction === 'refund' ? 'Processing...' : 'Issue Refund'}
          </Button>
        )}
      </div>

      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
            <Button onClick={confirmDialog.action}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
