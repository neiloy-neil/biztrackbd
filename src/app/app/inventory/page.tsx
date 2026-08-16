import { Suspense } from 'react'
import { getProducts } from '@/domains/inventory/actions'
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
  const res = await getProducts({ search: resolvedSearchParams.search, lowStockOnly: isLowStockOnly })
  const products = res.success ? (res.data as any[]) : []

  const totalValue = products.reduce((sum, p) => sum + (Number(p.current_stock) * Number(p.price)), 0)
  const lowStockCount = products.filter(p => Number(p.current_stock) <= Number(p.min_stock)).length

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
            <div className="text-2xl font-bold text-slate-900">{products.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">স্টক ভ্যালু</CardTitle>
            <span className="text-xl font-bold text-slate-400">৳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-rose-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-600">লো-স্টক অ্যালার্ট</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{lowStockCount}</div>
            <Link href="?lowStock=true" className="text-xs text-rose-500 hover:underline">
              দেখুন &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <form className="flex gap-2 max-w-sm">
            <Input 
              name="search" 
              defaultValue={resolvedSearchParams.search} 
              placeholder="নাম, SKU, বা বারকোড দিয়ে খুঁজুন..." 
              className="bg-slate-50"
            />
            <Button type="submit" variant="secondary">খুঁজুন</Button>
            {resolvedSearchParams.search || resolvedSearchParams.lowStock ? (
              <Link href="/inventory">
                <Button variant="ghost">ক্লিয়ার</Button>
              </Link>
            ) : null}
          </form>
        </div>

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
        </div>
      </div>
    </div>
  )
}
