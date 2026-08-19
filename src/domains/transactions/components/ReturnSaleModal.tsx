'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Undo2, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTransactionForReturn, processSaleReturnAction } from '../actions'

interface ReturnSaleModalProps {
  transactionId: string
  
}

export function ReturnSaleModal({ transactionId }: ReturnSaleModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [data, setData] = useState<any>(null)
  const [accounts, setAccounts] = useState<{id: string, name: string, type: string}[]>([])
  
  // Form State
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [refundAccount, setRefundAccount] = useState<string>('none')
  const [refundAmount, setRefundAmount] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  const fetchDetails = async () => {
    setIsLoading(true)
    const [res, accRes] = await Promise.all([
      getTransactionForReturn({ id: transactionId }),
      import('../actions').then(m => m.getAccounts())
    ])
    setIsLoading(false)
    if (res.success && res.data) {
      setData(res.data)
      const initialQty: Record<string, number> = {}
      res.data.items.forEach((i: any) => {
        initialQty[i.id] = 0
      })
      setReturnQty(initialQty)
      if (accRes.success && accRes.data) {
        setAccounts(accRes.data)
      }
    } else {
      toast.error((res as any).error || 'Failed to fetch transaction details')
      setIsOpen(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !data) {
      fetchDetails()
    }
  }

  const handleQtyChange = (itemId: string, value: string, max: number) => {
    let num = parseFloat(value) || 0
    if (num < 0) num = 0
    if (num > max) num = max
    setReturnQty(prev => ({ ...prev, [itemId]: num }))
  }

  const calculateTotalReturn = () => {
    if (!data) return 0
    let total = 0
    data.items.forEach((item: any) => {
      const qty = returnQty[item.id] || 0
      total += qty * item.unit_price
    })
    return total
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('দয়া করে রিটার্নের কারণ লিখুন (Please enter a reason)')
      return
    }

    const itemsToReturn = Object.entries(returnQty)
      .map(([id, qty]) => ({ id, return_qty: qty }))
      .filter(i => i.return_qty > 0)

    if (itemsToReturn.length === 0) {
      toast.error('অন্তত একটি আইটেম রিটার্ন করতে হবে (Select at least one item)')
      return
    }

    const payments = []
    if (refundAccount !== 'none') {
      const rAmount = parseFloat(refundAmount)
      if (rAmount > 0) {
        payments.push({ account_id: refundAccount, amount: rAmount })
      }
    }

    setIsSubmitting(true)
    const res = await processSaleReturnAction({
      transaction_id: transactionId,
      items: itemsToReturn,
      payments,
      reason,
      idempotencyKey: `return_${transactionId}_${Date.now()}`
    })
    setIsSubmitting(false)

    if (res?.success) {
      toast.success('রিটার্ন সফলভাবে সম্পন্ন হয়েছে (Return processed successfully)')
      setIsOpen(false)
    } else {
      toast.error(res?.error || 'Failed to process return')
    }
  }

  const totalReturnValue = calculateTotalReturn()

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="h-8 gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
          <Undo2 className="h-4 w-4" />
          <span>রিটার্ন / রিফান্ড (Return)</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>সেলস রিটার্ন (Sales Return)</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : !data ? (
          <div className="py-8 text-center text-rose-500 flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" /> 
            Failed to load transaction data
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Items List */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">আইটেম নির্বাচন করুন (Select Items)</h3>
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-600">আইটেম (Item)</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-center">মূল্য (Price)</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-center">ফেরত পরিমাণ (Return Qty)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.map((item: any) => {
                      const maxReturnable = item.quantity - item.returned_quantity
                      const isFullyReturned = maxReturnable <= 0

                      return (
                        <tr key={item.id} className={isFullyReturned ? "bg-slate-50 opacity-60" : "bg-white"}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{item.product?.name || 'Unknown Item'}</p>
                            <p className="text-xs text-slate-500">
                              বিক্রি: {item.quantity} | ফেরত দেওয়া হয়েছে: {item.returned_quantity}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            ৳{Number(item.unit_price).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {isFullyReturned ? (
                              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
                                Fully Returned
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <Input 
                                  type="number" 
                                  min={0} 
                                  max={maxReturnable} 
                                  step={0.01}
                                  value={returnQty[item.id] || ''}
                                  onChange={(e) => handleQtyChange(item.id, e.target.value, maxReturnable)}
                                  className="w-20 text-center h-8"
                                />
                                <span className="text-xs text-slate-500">/ {maxReturnable}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-lg">
              <span className="font-semibold text-orange-900">মোট রিটার্ন মূল্য (Total Return Value):</span>
              <span className="text-xl font-bold text-orange-700">৳{totalReturnValue.toLocaleString()}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>রিফান্ড অ্যাকাউন্ট (Refund Account)</Label>
                <Select value={refundAccount} onValueChange={(val) => setRefundAccount(val || 'none')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">কোনো নগদ রিফান্ড নয় (No Cash Refund - Adjust Due)</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">
                  {refundAccount === 'none' 
                    ? "Customer's due will be decreased by the return value."
                    : "Money will be deducted from this account and given to customer."
                  }
                </p>
              </div>

              {refundAccount !== 'none' && (
                <div className="space-y-2">
                  <Label>নগদ রিফান্ড পরিমাণ (Cash Refund Amount)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">৳</span>
                    <Input 
                      type="number" 
                      value={refundAmount} 
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>রিটার্নের কারণ (Reason for Return) *</Label>
              <Textarea 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                placeholder="যেমন: ড্যামেজ পণ্য, কাস্টমার পছন্দ করেনি..." 
                className="h-20"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 border-t pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !data || totalReturnValue === 0} 
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            কনফার্ম রিটার্ন (Confirm Return)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
