'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { MoreHorizontal, CalendarPlus, XCircle, Settings, ToggleRight, ToggleLeft } from 'lucide-react'
import { extendSubscriptionAction, cancelSubscriptionAction, changePlanAction, toggleCancelAtPeriodEndAction } from '../billing-actions'
import { toast } from 'sonner'
import { useTransition } from 'react'

export function SubscriptionActions({ 
  subscriptionId, 
  status,
  cancelAtPeriodEnd,
  planId,
  plans 
}: { 
  subscriptionId: string, 
  status: string,
  cancelAtPeriodEnd: boolean,
  planId: string,
  plans: any[]
}) {
  const [isPending, startTransition] = useTransition()
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState(planId)

  const handleExtend = () => {
    startTransition(async () => {
      try {
        await extendSubscriptionAction({ subscriptionId, days: 30 })
        toast.success('Subscription extended by 30 days')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this subscription immediately?')) return
    
    startTransition(async () => {
      try {
        await cancelSubscriptionAction({ subscriptionId })
        toast.success('Subscription cancelled')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  const handleToggleCancelAtPeriodEnd = () => {
    startTransition(async () => {
      try {
        await toggleCancelAtPeriodEndAction({ subscriptionId, cancelAtPeriodEnd: !cancelAtPeriodEnd })
        toast.success(`Subscription will ${!cancelAtPeriodEnd ? 'cancel at end of period' : 'renew normally'}`)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  const handleChangePlan = () => {
    if (selectedPlanId === planId) {
      setIsPlanModalOpen(false)
      return
    }
    startTransition(async () => {
      try {
        await changePlanAction({ subscriptionId, newPlanId: selectedPlanId })
        toast.success('Plan changed successfully')
        setIsPlanModalOpen(false)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50" disabled={isPending}>
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== 'cancelled' && (
            <>
              <DropdownMenuItem onClick={() => setIsPlanModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Change Plan</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExtend}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>Extend 30 Days</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleToggleCancelAtPeriodEnd}>
                {cancelAtPeriodEnd ? (
                  <><ToggleLeft className="mr-2 h-4 w-4" /><span>Resume Renewal</span></>
                ) : (
                  <><ToggleRight className="mr-2 h-4 w-4" /><span>Cancel at Period End</span></>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleCancel} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <XCircle className="mr-2 h-4 w-4" />
                <span>Cancel Immediately</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for this merchant. The change will take effect immediately and future renewals will use the new pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="plan">Available Plans</Label>
              <Select value={selectedPlanId} onValueChange={(val) => setSelectedPlanId(val as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - ৳{p.price_monthly}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanModalOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleChangePlan} disabled={isPending || selectedPlanId === planId}>
              {isPending ? 'Saving...' : 'Change Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
