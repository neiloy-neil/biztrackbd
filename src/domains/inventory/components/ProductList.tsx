'use client'

import { useState, useEffect } from 'react'
import { getProducts } from '@/domains/inventory/actions'
import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { useInView } from 'react-intersection-observer'

export function ProductList({ initialProducts, search, lowStockOnly }: { initialProducts: any[], search?: string, lowStockOnly?: boolean }) {
  const [products, setProducts] = useState<any[]>(initialProducts)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialProducts.length === 50 && !lowStockOnly)

  const { ref, inView } = useInView()

  useEffect(() => {
    setProducts(initialProducts)
    setHasMore(initialProducts.length === 50 && !lowStockOnly)
  }, [initialProducts, search, lowStockOnly])

  const loadMore = async () => {
    if (loading || !hasMore) return
    setLoading(true)
    
    const lastProduct = products[products.length - 1]
    const res = await getProducts({ search, lowStockOnly, cursorName: lastProduct?.name, cursorId: lastProduct?.id, limit: 50 })
    if (res?.success && res.data) {
      setProducts(prev => [...prev, ...res.data])
      setHasMore(res.data.length === 50)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (inView) {
      loadMore()
    }
  }, [inView])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' }).format(Math.abs(amount))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm">
            <th className="py-3 px-4 font-medium">প্রোডাক্টের নাম</th>
            <th className="py-3 px-4 font-medium">SKU / বারকোড</th>
            <th className="py-3 px-4 font-medium text-right">স্টক</th>
            <th className="py-3 px-4 font-medium text-right">বিক্রয় মূল্য</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map(p => {
            const stock = Number(p.current_stock)
            const min = Number(p.min_stock)
            const isLow = stock <= min

            return (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.category?.name || 'Category-less'}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm text-slate-600">{p.sku || '-'}</div>
                  <div className="text-xs text-slate-400">{p.barcode}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className={`text-base font-bold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                    {stock} {p.unit}
                  </div>
                  {isLow && <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded">Low</span>}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium text-slate-900">{formatCurrency(p.price)}</div>
                  <div className="text-xs text-slate-500">কেনা: {formatCurrency(p.cost)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/inventory/products/${p.id}`}>
                    <Button variant="ghost" size="icon" className="hover:bg-slate-200 text-slate-400 hover:text-slate-700">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            )
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-slate-500">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {hasMore && (
        <div ref={ref} className="text-center py-6 border-t border-slate-100 bg-slate-50 flex justify-center">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : (
            <span className="text-sm text-slate-400">Loading more...</span>
          )}
        </div>
      )}
    </div>
  )
}
