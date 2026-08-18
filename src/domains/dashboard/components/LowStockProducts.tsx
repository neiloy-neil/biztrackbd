import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLowStockProducts } from '../actions'
import { AlertTriangle } from 'lucide-react'

export async function LowStockProducts() {
  const res = await getLowStockProducts({ limit: 20 })

  if (!res?.success || !res.data) {
    return null
  }

  const products = res.data as any[]

  if (products.length === 0) return null

  return (
    <Card className="shadow-sm mt-6 border-rose-200 bg-rose-50/30">
      <CardHeader className="pb-3 border-b border-rose-100 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          স্টক কমে গেছে
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-rose-100">
          {products.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <span className="text-sm font-semibold text-slate-800">{p.name}</span>
              <span className="text-sm font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                {p.currentStock} / {p.minStock} পিস
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
