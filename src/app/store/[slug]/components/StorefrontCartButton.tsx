'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/domains/storefront/store/cart'
import { useEffect, useState } from 'react'

export function StorefrontCartButton({ slug }: { slug: string }) {
  const [mounted, setMounted] = useState(false)
  const items = useCartStore((state) => state.items)
  const itemCount = items.reduce((count, item) => count + item.quantity, 0)

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Link href={`/store/${slug}/checkout`} className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
      <ShoppingCart className="h-6 w-6" />
      {mounted && itemCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-rose-500 rounded-full">
          {itemCount}
        </span>
      )}
    </Link>
  )
}
