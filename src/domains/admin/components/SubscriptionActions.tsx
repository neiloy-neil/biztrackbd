'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, CalendarPlus, XCircle, CreditCard, RefreshCw } from 'lucide-react'
import { extendSubscriptionAction, cancelSubscriptionAction } from '../billing-actions'
import { toast } from 'sonner'
import { useTransition } from 'react'

export function SubscriptionActions({ subscriptionId, status }: { subscriptionId: string, status: string }) {
  const [isPending, startTransition] = useTransition()

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
    if (!confirm('Are you sure you want to cancel this subscription?')) return
    
    startTransition(async () => {
      try {
        await cancelSubscriptionAction({ subscriptionId })
        toast.success('Subscription cancelled')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50" disabled={isPending}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== 'cancelled' && (
          <>
            <DropdownMenuItem onClick={handleExtend}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              <span>Extend 30 Days</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCancel} className="text-red-600 focus:text-red-600 focus:bg-red-50">
              <XCircle className="mr-2 h-4 w-4" />
              <span>Cancel Subscription</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
