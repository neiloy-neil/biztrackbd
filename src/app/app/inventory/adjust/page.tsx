'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProducts, recordMovement } from '@/domains/inventory/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'

export default function AdjustInventoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<any[]>([])

  const [formData, setFormData] = useState({
    product_id: '',
    type: 'adjustment', // 'in', 'out', 'adjustment'
    quantity: '',
    reason: '',
    variant_id: '',
    lot_id: ''
  })

  useEffect(() => {
    getProducts({}).then(res => {
      if (res.success) setProducts(res.data as any[])
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'product_id') {
      setFormData(prev => ({ ...prev, product_id: value, variant_id: '', lot_id: '' }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }
  
  const selectedProduct = products.find(p => p.id === formData.product_id)
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const qty = Number(formData.quantity)
    if (!qty) {
      setError('সঠিক পরিমাণ লিখুন')
      setLoading(false)
      return
    }

    const res = await recordMovement({
      product_id: formData.product_id,
      variant_id: formData.variant_id || undefined,
      lot_id: formData.lot_id || undefined,
      type: formData.type as any,
      quantity: qty,
      reason: formData.reason
    })

    if (res.success) {
      router.push('/app/inventory')
    } else {
      setError(res.error || 'সংরক্ষণ করা যায়নি')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4 max-w-2xl mx-auto">
        <Link href="/app/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">স্টক সমন্বয় (Stock Adjustment)</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-2">
              <Label>প্রোডাক্ট *</Label>
              <select 
                required 
                name="product_id" 
                value={formData.product_id} 
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              >
                <option value="">-- প্রোডাক্ট নির্বাচন করুন --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (বর্তমান স্টক: {p.current_stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ধরণ *</Label>
                <select 
                  required 
                  name="type" 
                  value={formData.type} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                >
                  <option value="in">স্টক ইন (+)</option>
                  <option value="out">স্টক আউট (-)</option>
                  <option value="adjustment">সমন্বয় (+/-)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>পরিমাণ *</Label>
                <Input required type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" />
                <p className="text-[10px] text-slate-500">স্টক কমাতে মাইনাস (-) ব্যবহার করুন শুধুমাত্র সমন্বয়ের ক্ষেত্রে।</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>কারণ (নোট)</Label>
              <Input name="reason" value={formData.reason} onChange={handleChange} placeholder="যেমন: ড্যামেজ, রিটার্ন, ভুল এন্ট্রি" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <Button type="submit" className="w-full bg-[#007AFF] hover:bg-[#005bb5]" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              আপডেট স্টক
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
