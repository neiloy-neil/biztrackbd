'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { createCoupon } from '@/domains/admin/promotions'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CreateCouponForm({ plans }: { plans: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [duration, setDuration] = useState('once')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    try {
      await createCoupon({
        code: formData.get('code') as string,
        type: formData.get('type') as string,
        value: parseFloat(formData.get('value') as string),
        duration: formData.get('duration') as string,
        duration_in_months: formData.get('duration_in_months') ? parseInt(formData.get('duration_in_months') as string) : null,
        target_plan_id: formData.get('target_plan_id') as string || null,
        eligibility: formData.get('eligibility') as string,
        max_redemptions: formData.get('max_redemptions') ? parseInt(formData.get('max_redemptions') as string) : null,
        expires_at: formData.get('expires_at') as string || null
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-700")}>
        <Plus className="w-4 h-4 mr-2" />
        Create Coupon
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Promotion</DialogTitle>
          <DialogDescription>
            Create a new discount code for your customers.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          {error && <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code</Label>
              <Input id="code" name="code" placeholder="e.g. SUMMER50" required className="uppercase" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Discount Type</Label>
              <Select name="type" defaultValue="percentage">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (BDT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Discount Value</Label>
            <Input id="value" name="value" type="number" step="0.01" min="0" required placeholder="e.g. 50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select name="duration" value={duration} onValueChange={(val) => val && setDuration(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">First Month Only</SelectItem>
                  <SelectItem value="repeating">Multiple Months</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {duration === 'repeating' && (
              <div className="space-y-2">
                <Label htmlFor="duration_in_months">Months</Label>
                <Input id="duration_in_months" name="duration_in_months" type="number" min="2" required placeholder="e.g. 3" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eligibility">Customer Eligibility</Label>
            <Select name="eligibility" defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="new_only">New Customers Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_plan_id">Target Plan (Optional)</Label>
            <Select name="target_plan_id">
              <SelectTrigger>
                <SelectValue placeholder="Any Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any Plan</SelectItem>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_redemptions">Max Uses (Optional)</Label>
              <Input id="max_redemptions" name="max_redemptions" type="number" min="1" placeholder="Unlimited" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expires_at">Expires At (Optional)</Label>
              <Input id="expires_at" name="expires_at" type="datetime-local" />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Coupon
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
