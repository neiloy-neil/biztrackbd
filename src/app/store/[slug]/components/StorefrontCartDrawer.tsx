'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/domains/storefront/store/cart'
import Link from 'next/link'

export function StorefrontCartDrawer({ slug }: { slug: string }) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const cartState = useCartStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="relative p-2 rounded-full">
        <ShoppingCart className="h-6 w-6 opacity-50" />
      </div>
    )
  }

  const { items, updateQuantity, removeItem } = cartState
  const itemCount = items.reduce((count, item) => count + item.quantity, 0)
  const cartTotal = items.reduce((total, item) => total + (item.unit_price * item.quantity), 0)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger className="relative p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white">
        <ShoppingCart className="h-6 w-6" />
        {itemCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-rose-500 rounded-full">
            {itemCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Shopping Cart ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
            <ShoppingCart className="h-16 w-16 opacity-20" />
            <p>Your cart is empty.</p>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Continue Shopping</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 -mx-6 px-6 overflow-y-auto">
              <div className="space-y-6 pt-6">
                {items.map((item) => (
                  <div key={`${item.product_id}-${item.variant_id || 'base'}`} className="flex gap-4">
                    <div className="h-20 w-20 bg-slate-100 rounded-md flex items-center justify-center border text-slate-400 shrink-0">
                      🛍️
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-slate-900 line-clamp-2 leading-tight">
                            {item.name}
                          </h4>
                          {item.variant_name && (
                            <p className="text-sm text-slate-500 mt-1">{item.variant_name}</p>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 ml-4">
                          ৳{(item.unit_price * item.quantity).toLocaleString('en-IN')}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border rounded-md">
                          <button 
                            className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.variant_id)}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button 
                            className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button 
                          className="text-red-500 hover:text-red-700 p-1.5"
                          onClick={() => removeItem(item.product_id, item.variant_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>Subtotal</span>
                <span>৳{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-sm text-slate-500">Delivery fees calculated at checkout.</p>
              <Link href={`/store/${slug}/checkout`} onClick={() => setIsOpen(false)}>
                <Button className="w-full h-12 text-base font-semibold">
                  Proceed to Checkout
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
