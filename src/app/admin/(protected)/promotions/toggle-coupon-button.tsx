'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { toggleCouponActive } from '@/domains/admin/promotions'
import { toast } from 'sonner'

export default function ToggleCouponButton({ couponId, isActive }: { couponId: string, isActive: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleToggle(checked: boolean) {
    setLoading(true)
    try {
      await toggleCouponActive({ couponId, isActive: checked })
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to toggle coupon')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Switch 
      checked={isActive} 
      onCheckedChange={handleToggle}
      disabled={loading}
    />
  )
}
