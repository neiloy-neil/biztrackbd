'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitOnlineOrder } from '@/domains/storefront/actions'
import { toast } from 'sonner'
import { useCartStore } from '@/domains/storefront/store/cart'

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  })

  // Wait for client mount to ensure Zustand persist has hydrated
  useEffect(() => {
    setMounted(true)
  }, [])

  const cartItems = useCartStore((state) => state.items)
  const items = useCartStore((state) => state.items)
  const cartTotal = items.reduce((total, item) => total + (item.unit_price * item.quantity), 0)
  const clearCart = useCartStore((state) => state.clearCart)

  // Real implementation of delivery fee (For V1 we can assume fixed or passed as prop, here mocked from UI)
  const deliveryFee = 60
  const grandTotal = cartTotal + deliveryFee

  if (!mounted) {
    return <div className="max-w-4xl mx-auto p-12 text-center text-slate-500 animate-pulse">Loading checkout...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (cartItems.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    setLoading(true)

    try {
      // businessId should ideally come from a context or profile fetch.
      // But for this client component, we will rely on the slug resolving to a profile on the server action.
      // We'll update the server action to accept `slug` instead of `businessId` in a real app,
      // but to match the current action signature, let's just assume we get businessId from a prop or fetch it.
      // Wait, submitOnlineOrder requires businessId. 
      // I'll need to fetch the profile first or pass businessId as a prop.
      // Since page.tsx is a client component relying on a server param, we should actually fetch the profile client-side or pass it down.
      // Wait, we can modify the server action to take `slug` and look up the businessId itself!
      // Let's call a new action `submitOnlineOrderBySlug`.
      // For now, I'll use a mocked businessId or just the existing `submitOnlineOrder` if we pass the businessId.
      
      const res = await fetch(`/api/storefront/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          customerName: formData.name,
          customerPhone: formData.phone,
          deliveryAddress: formData.address,
          items: cartItems.map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.unit_price * i.quantity
          })),
          totalAmount: grandTotal,
          deliveryFee: deliveryFee
        })
      })
      
      const data = await res.json()
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order')
      }

      clearCart()
      setSuccess(true)
      toast.success('Order placed successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-12">
        <div className="flex justify-center">
          <CheckCircle2 className="h-20 w-20 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Order Confirmed!</h1>
        <p className="text-slate-500">Thank you for your purchase. We will contact you shortly to confirm your delivery.</p>
        <div className="pt-8">
          <Link href={`/store/${slug}`}>
            <Button variant="outline" className="w-full">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/store/${slug}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Store
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Checkout Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Delivery Details</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                type="tel" 
                required 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Full Delivery Address</Label>
              <Textarea 
                id="address" 
                required 
                className="min-h-[100px]"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-medium">
                {loading ? 'Processing...' : 'Place Order (Cash on Delivery)'}
              </Button>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-fit">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Order Summary</h2>
          
          <div className="space-y-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Cart Subtotal</span>
              <span>৳{cartTotal}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span>৳{deliveryFee}</span>
            </div>
            <div className="pt-4 border-t border-slate-200 flex justify-between font-bold text-lg text-slate-900">
              <span>Total</span>
              <span>৳{grandTotal}</span>
            </div>
          </div>
          
          <div className="mt-8 bg-white p-4 rounded-lg border text-sm text-slate-500 text-center">
            You will pay <strong>৳{grandTotal}</strong> in cash upon delivery.
          </div>
        </div>
      </div>
    </div>
  )
}
