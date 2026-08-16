'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct } from '@/domains/inventory/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    unit: 'pcs',
    min_stock: '0',
    initial_stock: '0',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await createProduct({
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode,
      price: Number(formData.price),
      cost: Number(formData.cost),
      unit: formData.unit,
      min_stock: Number(formData.min_stock),
      initial_stock: Number(formData.initial_stock)
    })

    if (res.success) {
      router.push('/inventory')
    } else {
      setError(res.error || 'সংরক্ষণ করা যায়নি')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4 max-w-2xl mx-auto">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">নতুন প্রোডাক্ট যোগ করুন</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label>প্রোডাক্টের নাম *</Label>
              <Input required name="name" value={formData.name} onChange={handleChange} placeholder="যেমন: Lux Soap 100g" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>বিক্রয় মূল্য (Price) *</Label>
                <Input required type="number" min="0" step="0.01" name="price" value={formData.price} onChange={handleChange} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>ক্রয় মূল্য (Cost) *</Label>
                <Input required type="number" min="0" step="0.01" name="cost" value={formData.cost} onChange={handleChange} placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input name="sku" value={formData.sku} onChange={handleChange} placeholder="Stock Keeping Unit" />
              </div>
              <div className="space-y-2">
                <Label>বারকোড (Barcode)</Label>
                <Input name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Scan or type barcode" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ইউনিট (Unit) *</Label>
                <Input required name="unit" value={formData.unit} onChange={handleChange} placeholder="pcs, kg, box" />
              </div>
              <div className="space-y-2">
                <Label>প্রারম্ভিক স্টক (Initial Stock)</Label>
                <Input type="number" min="0" name="initial_stock" value={formData.initial_stock} onChange={handleChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>লো-স্টক অ্যালার্ট</Label>
                <Input required type="number" min="0" name="min_stock" value={formData.min_stock} onChange={handleChange} placeholder="0" />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <Button type="submit" className="w-full bg-[#007AFF] hover:bg-[#005bb5]" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              সেভ করুন
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
