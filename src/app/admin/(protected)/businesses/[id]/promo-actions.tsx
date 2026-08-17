'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { extendTrial, grantPromotionalCredit } from '@/domains/admin/promotions'
import { CalendarPlus, Coins, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ExtendTrialButton({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const days = parseInt(new FormData(e.currentTarget).get('days') as string)
    try {
      await extendTrial({ businessId, days })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
        <CalendarPlus className="w-4 h-4 mr-2" />
        Extend Trial
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial</DialogTitle>
            <DialogDescription>Add more days to this business's current trial period.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Days to add</Label>
              <Input name="days" type="number" min="1" defaultValue="7" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Extend
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function GrantCreditButton({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await grantPromotionalCredit({
        businessId,
        amount: parseFloat(formData.get('amount') as string),
        reason: formData.get('reason') as string
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-green-600 border-green-200 hover:bg-green-50">
        <Coins className="w-4 h-4 mr-2" />
        Grant Credit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Promotional Credit</DialogTitle>
            <DialogDescription>Give this business account credits that will be applied to future invoices.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (BDT)</Label>
              <Input name="amount" type="number" step="0.01" min="1" placeholder="e.g. 500" required />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input name="reason" placeholder="e.g. Loyalty reward, Issue compensation" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Grant
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
