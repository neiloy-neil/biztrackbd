'use client'

import { Button } from '@/components/ui/button'
import { useCartStore } from '@/domains/storefront/store/cart'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export function QuickAddToCartButton({ 
  product, 
  themeColor 
}: { 
  product: any
  themeColor: string 
}) {
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault() // prevent navigating to product detail
    
    // Only allow quick add if no variants
    if (product.variants && product.variants.length > 0) {
      toast.error('Please view product details to select a variant.')
      return
    }

    addItem({
      product_id: product.id,
      name: product.name,
      unit_price: product.online_price,
      quantity: 1
    })
    
    toast.success('Added to cart')
  }

  return (
    <Button 
      size="sm" 
      variant="secondary" 
      className="px-3" 
      style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
      onClick={handleAddToCart}
    >
      <Plus className="h-4 w-4 mr-1" />
      Add
    </Button>
  )
}
