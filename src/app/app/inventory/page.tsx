import { Suspense } from 'react'
import { getProducts } from '@/domains/inventory/actions'
import { getInventoryStats } from '@/domains/inventory/stats-actions'
import { ProductList } from '@/domains/inventory/components/ProductList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Package, AlertTriangle, ArrowRight, Plus } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'

export default async function InventoryDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string; lowStock?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const isLowStockOnly = resolvedSearchParams.lowStock === 'true'
  const search = resolvedSearchParams.search

  const [productsRes, statsRes] = await Promise.all([
    getProducts({ search, lowStockOnly: isLowStockOnly, limit: 50 }),
    getInventoryStats()
  ])
  
  const products = productsRes.success ? (productsRes.data as any[]) : []
  const stats = statsRes?.success ? statsRes.data : { total_items: 0, total_value: 0, low_stock_count: 0 }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' }).format(Math.abs(amount))
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">ইনভেন্টরি (Inventory)</h2>
        <div className="flex gap-2">
          <Link href="/inventory/adjust">
            <Button variant="outline" className="hidden sm:flex">
              স্টক সমন্বয়
            </Button>
          </Link>
          <Link href="/inventory/products/new">
            <Button className="bg-[#007AFF] hover:bg-[#005bb5]">
              <Plus className="mr-2 h-4 w-4" /> নতুন প্রোডাক্ট
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">মোট প্রোডাক্ট</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.total_items}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">স্টক ভ্যালু</CardTitle>
            <span className="text-xl font-bold text-slate-400">৳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.total_value)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-rose-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-600">লো-স্টক অ্যালার্ট</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{stats.low_stock_count}</div>
            <Link href="?lowStock=true" className="text-xs text-rose-500 hover:underline">
              দেখুন &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 max-w-sm">
            <Input 
              name="search" 
              defaultValue={search} 
              placeholder="নাম, SKU, বা বারকোড দিয়ে খুঁজুন..." 
              className="bg-slate-50"
            />
            <Button type="submit" variant="secondary">খুঁজুন</Button>
            {search || isLowStockOnly ? (
              <Link href="/app/inventory">
                <Button variant="ghost">ক্লিয়ার</Button>
              </Link>
            ) : null}
          </form>
        </div>

        <ProductList initialProducts={products} search={search} lowStockOnly={isLowStockOnly} />
      </div>
    </div>
  )
}
