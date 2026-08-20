'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitOnlineOrder } from '@/domains/storefront/actions'
import { toast } from 'sonner'

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  })

  // For V1 UI mockup, we will simulate an empty cart or a mock item.
  // Real implementation will use a client-side CartProvider (localStorage/zustand)
  const cartTotal = 1500
  const deliveryFee = 60
  const grandTotal = cartTotal + deliveryFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // In a real flow, businessId is fetched from context, and items from the CartProvider
      // For this step, we will mock the submission since we are just building the skeleton UI
      setTimeout(() => {
        setSuccess(true)
        setLoading(false)
        toast.success('Order placed successfully!')
      }, 1500)
    } catch (err) {
      toast.error('Failed to place order')
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
