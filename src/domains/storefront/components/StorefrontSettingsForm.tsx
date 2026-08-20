'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateStorefrontSettings } from '@/domains/storefront/owner-actions'
import { toast } from 'sonner'
import { Store, Link as LinkIcon, Truck } from 'lucide-react'

export function StorefrontSettingsForm({ initialData }: { initialData: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    slug: initialData?.slug || '',
    themeColor: initialData?.theme_color || '#007AFF',
    isActive: initialData?.is_active ?? false,
    flatDeliveryFee: initialData?.flat_delivery_fee || 60
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await updateStorefrontSettings(formData)
      if (res.success) {
        toast.success('Storefront settings updated')
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to update settings')
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4 bg-slate-50">
        <div className="space-y-0.5">
          <Label className="text-base font-semibold">Enable Storefront</Label>
          <p className="text-sm text-muted-foreground">
            Allow customers to visit your online store and place orders.
          </p>
        </div>
        <Switch 
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slug" className="flex items-center">
            <LinkIcon className="h-4 w-4 mr-2" /> Store URL Slug
          </Label>
          <div className="flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
              biztrackbd.com/store/
            </span>
            <Input
              id="slug"
              type="text"
              className="rounded-l-none"
              placeholder="my-shop"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              required
            />
          </div>
          <p className="text-xs text-slate-500">Must be unique. Only lowercase letters, numbers, and hyphens.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery" className="flex items-center">
            <Truck className="h-4 w-4 mr-2" /> Flat Delivery Fee (BDT)
          </Label>
          <Input
            id="delivery"
            type="number"
            min="0"
            step="1"
            value={formData.flatDeliveryFee}
            onChange={(e) => setFormData({ ...formData, flatDeliveryFee: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme Color</Label>
          <div className="flex items-center space-x-3">
            <Input
              id="theme"
              type="color"
              className="h-10 w-20 p-1 cursor-pointer"
              value={formData.themeColor}
              onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
            />
            <Input 
              type="text" 
              value={formData.themeColor} 
              onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
              className="font-mono uppercase w-32"
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-[#007AFF] hover:bg-[#005bb5]">
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>

      {formData.isActive && formData.slug && (
        <div className="mt-8 pt-6 border-t flex flex-col items-center justify-center space-y-4">
          <Store className="h-12 w-12 text-slate-300" />
          <div className="text-center">
            <h4 className="font-medium text-slate-900">Your store is live!</h4>
            <a 
              href={`/store/${formData.slug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-[#007AFF] hover:underline"
            >
              biztrackbd.com/store/{formData.slug}
            </a>
          </div>
        </div>
      )}
    </form>
  )
}
