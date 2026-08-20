'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/domains/storefront/store/cart'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ProductDetailClient({ 
  product, 
  themeColor 
}: { 
  product: any
  themeColor: string 
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const addItem = useCartStore((state) => state.addItem)

  const selectedVariant = product.variants?.find((v: any) => v.id === selectedVariantId)
  const price = Number(product.online_price || 0) + (selectedVariant?.price_adjustment || 0)

  const handleAddToCart = () => {
    if (product.variants && product.variants.length > 0 && !selectedVariantId) {
      toast.error('Please select an option')
      return
    }

    let variantName = undefined
    if (selectedVariant) {
      const parts = []
      if (selectedVariant.size) parts.push(`Size: ${selectedVariant.size}`)
      if (selectedVariant.color) parts.push(`Color: ${selectedVariant.color}`)
      variantName = parts.join(', ')
    }

    addItem({
      product_id: product.id,
      variant_id: selectedVariantId || undefined,
      name: product.name,
      variant_name: variantName,
      unit_price: price,
      quantity: 1
    })

    toast.success('Added to cart')
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="space-y-2">
        <div className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
          {product.category?.[0]?.name || 'Uncategorized'}
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
        <p className="text-slate-500">SKU/Barcode: {product.barcode}</p>
      </div>

      <div className="text-4xl font-extrabold tracking-tight" style={{ color: themeColor }}>
        ৳{price.toLocaleString('en-IN')}
      </div>

      {product.variants && product.variants.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Available Options</h3>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v: any) => (
              <div 
                key={v.id} 
                onClick={() => setSelectedVariantId(v.id)}
                className={cn(
                  "px-4 py-2 rounded-md border text-sm font-medium cursor-pointer transition-colors",
                  selectedVariantId === v.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:border-slate-400 text-slate-900"
                )}
                style={selectedVariantId === v.id ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
              >
                {v.size && `Size: ${v.size} `}
                {v.color && `Color: ${v.color}`}
                {v.price_adjustment > 0 && ` (+৳${v.price_adjustment})`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-8">
        <Button 
          size="lg" 
          className="w-full text-base font-semibold h-14" 
          style={{ backgroundColor: themeColor }}
          onClick={handleAddToCart}
        >
          <ShoppingBag className="mr-2 h-5 w-5" /> Add to Cart
        </Button>
      </div>
    </div>
  )
}
