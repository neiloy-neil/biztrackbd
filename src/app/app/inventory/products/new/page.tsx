'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct } from '@/domains/inventory/actions'
import { getBusinessTaxProfile } from '@/domains/settings/actions'
import { useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxData, setTaxData] = useState({ is_taxable: true, hs_code: '', vat_rate: 0 })
  useEffect(() => { getBusinessTaxProfile().then(r => { if (r?.success && r.data?.vat_enabled) { setTaxEnabled(true); setTaxData(d => ({...d, vat_rate: r.data.default_vat_rate || 0})) } }) }, [])
  
  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '', price: '', cost: '', unit: 'pcs', min_stock: '0', initial_stock: '0', tracking_type: 'simple'
  })

  const [variants, setVariants] = useState<{sku: string, name_override: string, price_override: string}[]>([])
  const [lots, setLots] = useState<{identifier: string, expiry_date: string}[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const v = variants.map(v => ({...v, price_override: Number(v.price_override), attributes: {}}))

    const res = await createProduct({
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode,
      price: Number(formData.price),
      cost: Number(formData.cost),
      unit: formData.unit,
      min_stock: Number(formData.min_stock),
      initial_stock: Number(formData.initial_stock),
      tracking_type: formData.tracking_type as any,
      variants: v,
      lots: lots,
      tax_meta: taxEnabled ? taxData : undefined
    })

    if (res.success) {
      router.push('/app/inventory')
    } else {
      setError(res.error || 'Failed to save product')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4 max-w-2xl mx-auto">
        <Link href="/app/inventory"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">New Product</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        <Card className="border-none shadow-sm"><CardContent className="p-6 space-y-4">
            <div className="space-y-2"><Label>Product Name *</Label><Input required name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Lux Soap 100g" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Price *</Label><Input required type="number" min="0" step="0.01" name="price" value={formData.price} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Cost *</Label><Input required type="number" min="0" step="0.01" name="cost" value={formData.cost} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tracking Type</Label>
                <select name="tracking_type" value={formData.tracking_type} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="simple">Simple</option>
                  <option value="variant">Variants (Size, Color)</option>
                  <option value="batch">Batch / Expiry</option>
                  <option value="serialized">Serialized (IMEI, SN)</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Unit *</Label><Input required name="unit" value={formData.unit} onChange={handleChange} placeholder="pcs, kg, box" /></div>
            </div>
            {formData.tracking_type === 'simple' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Initial Stock</Label><Input type="number" name="initial_stock" value={formData.initial_stock} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>SKU</Label><Input name="sku" value={formData.sku} onChange={handleChange} /></div>
              </div>
            )}
        </CardContent></Card>

        {taxEnabled && (
          <Card className="border-none shadow-sm"><CardContent className="p-6 space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">VAT / Tax Config</h3>
                <Switch checked={taxData.is_taxable} onCheckedChange={c => setTaxData(prev => ({...prev, is_taxable: c}))} />
             </div>
             {taxData.is_taxable && (
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2"><Label>HS Code</Label><Input value={taxData.hs_code} onChange={e => setTaxData(prev => ({...prev, hs_code: e.target.value}))} placeholder="e.g. 1234.56.78" /></div>
                 <div className="space-y-2"><Label>Specific VAT Rate (%)</Label><Input type="number" min="0" value={taxData.vat_rate} onChange={e => setTaxData(prev => ({...prev, vat_rate: Number(e.target.value)}))} /></div>
               </div>
             )}
          </CardContent></Card>
        )}

        {formData.tracking_type === 'variant' && (
           <Card className="border-none shadow-sm"><CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg flex items-center justify-between">Variants
                <Button type="button" variant="outline" size="sm" onClick={() => setVariants([...variants, {sku: '', name_override: '', price_override: ''}])}><Plus className="h-4 w-4 mr-2"/> Add Variant</Button>
              </h3>
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center bg-slate-50 p-3 rounded border">
                  <Input placeholder="Size/Color (e.g. XL-Red)" value={v.name_override} onChange={e => {const nv = [...variants]; nv[i].name_override = e.target.value; setVariants(nv)}} />
                  <Input placeholder="SKU" value={v.sku} onChange={e => {const nv = [...variants]; nv[i].sku = e.target.value; setVariants(nv)}} />
                  <Input type="number" placeholder="Price" value={v.price_override} onChange={e => {const nv = [...variants]; nv[i].price_override = e.target.value; setVariants(nv)}} />
                  <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
           </CardContent></Card>
        )}

        {(formData.tracking_type === 'batch' || formData.tracking_type === 'serialized') && (
           <Card className="border-none shadow-sm"><CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg flex items-center justify-between">Lots / Serials
                <Button type="button" variant="outline" size="sm" onClick={() => setLots([...lots, {identifier: '', expiry_date: ''}])}><Plus className="h-4 w-4 mr-2"/> Add Lot</Button>
              </h3>
              {lots.map((l, i) => (
                <div key={i} className="flex gap-2 items-center bg-slate-50 p-3 rounded border">
                  <Input placeholder="Batch/Serial/IMEI" value={l.identifier} onChange={e => {const nl = [...lots]; nl[i].identifier = e.target.value; setLots(nl)}} />
                  {formData.tracking_type === 'batch' && <Input type="date" placeholder="Expiry Date" value={l.expiry_date} onChange={e => {const nl = [...lots]; nl[i].expiry_date = e.target.value; setLots(nl)}} />}
                  <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setLots(lots.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
           </CardContent></Card>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" className="w-full bg-[#007AFF] hover:bg-[#005bb5]" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Product
        </Button>
      </form>
    </div>
  )
}
