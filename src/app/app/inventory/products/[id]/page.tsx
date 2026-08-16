import { Suspense } from 'react'
import { getProductHistory, getProducts } from '@/domains/inventory/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, History, Package } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { format } from '@/lib/utils/date'

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // We need the specific product. For now, fetch all and filter.
  // In a real app, write a specific `getProduct(id)` action.
  const { id } = await params
  const res = await getProducts({})
  const products = res.success ? (res.data as any[]) : []
  const product = products.find(p => p.id === id)

  const historyRes = await getProductHistory({ productId: id })
  const history = historyRes.success ? (historyRes.data as any[]) : []

  if (!product) {
    return <div className="p-8 text-center">প্রোডাক্ট পাওয়া যায়নি।</div>
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' }).format(amount)
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">প্রোডাক্ট বিস্তারিত</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Product Info Card */}
        <Card className="border-none shadow-sm md:col-span-1 bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center mb-4">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="object-cover w-full h-full rounded-lg" />
              ) : (
                <Package className="h-16 w-16 text-slate-300" />
              )}
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-slate-900">{product.name}</h3>
              <p className="text-sm text-slate-500">{product.category?.name || 'No Category'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">বর্তমান স্টক</p>
                <p className={`text-lg font-bold ${product.current_stock <= product.min_stock ? 'text-rose-600' : 'text-slate-900'}`}>
                  {product.current_stock} {product.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">মিনিমাম স্টক</p>
                <p className="text-lg font-medium text-slate-700">{product.min_stock} {product.unit}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">বিক্রয় মূল্য</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(product.price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ক্রয় মূল্য</p>
                <p className="text-lg font-medium text-slate-700">{formatCurrency(product.cost)}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 text-sm text-slate-600">
              <p><span className="font-medium">SKU:</span> {product.sku || '-'}</p>
              <p><span className="font-medium">Barcode:</span> {product.barcode || '-'}</p>
              <p><span className="font-medium">Supplier:</span> {product.supplier?.name || '-'}</p>
            </div>

            <Link href="/inventory/adjust" className="block pt-4">
              <Button className="w-full" variant="outline">স্টক সমন্বয় করুন</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Stock Ledger */}
        <Card className="border-none shadow-sm md:col-span-2 bg-white">
          <CardContent className="p-6">
            <Tabs defaultValue="ledger">
              <TabsList className="mb-4">
                <TabsTrigger value="ledger"><History className="w-4 h-4 mr-2" /> স্টক লেজার (Ledger)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="ledger">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm">
                        <th className="py-3 px-4 font-medium">তারিখ</th>
                        <th className="py-3 px-4 font-medium">বিবরণ</th>
                        <th className="py-3 px-4 font-medium text-right">আগে</th>
                        <th className="py-3 px-4 font-medium text-right">পরিমাণ</th>
                        <th className="py-3 px-4 font-medium text-right">পরে</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map(mov => (
                        <tr key={mov.id} className="hover:bg-slate-50 text-sm">
                          <td className="py-3 px-4 text-slate-600">
                            {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 capitalize">
                              {mov.type === 'in' ? 'Stock In' : mov.type === 'out' ? 'Stock Out' : 'Adjustment'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {mov.transaction?.reference ? `Ref: ${mov.transaction.reference}` : mov.reason || 'Manual entry'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">{mov.before_quantity}</td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            mov.type === 'in' ? 'text-emerald-600' : mov.type === 'out' ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            {mov.type === 'in' ? '+' : mov.type === 'out' ? '-' : ''}{mov.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">{mov.after_quantity}</td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">কোনো হিস্ট্রি নেই।</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
