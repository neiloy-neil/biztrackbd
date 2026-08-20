import { getStorefrontProfileBySlug, getStorefrontProducts } from '@/domains/storefront/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShoppingBag } from 'lucide-react'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const resolvedParams = await params
  const { slug, id } = resolvedParams

  const profileRes = await getStorefrontProfileBySlug(slug)
  if (!profileRes.success || !profileRes.data) notFound()
  const profile = profileRes.data

  const productsRes = await getStorefrontProducts(profile.business_id)
  if (!productsRes.success || !productsRes.data) notFound()
  
  const product = productsRes.data.find((p: any) => p.id === id)
  if (!product) notFound()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/store/${slug}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Store
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid md:grid-cols-2 gap-8 p-8">
          {/* Product Image Placeholder */}
          <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
            <span className="text-8xl">🛍️</span>
          </div>

          {/* Product Info */}
          <div className="space-y-6 flex flex-col">
            <div className="space-y-2">
              <div className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
                {product.category?.[0]?.name || 'Uncategorized'}
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
              <p className="text-slate-500">SKU/Barcode: {product.barcode}</p>
            </div>

            <div className="text-4xl font-extrabold tracking-tight" style={{ color: profile.theme_color }}>
              ৳{Number(product.online_price || 0).toLocaleString('en-IN')}
            </div>

            {/* Variants Selection (if any) */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-slate-900">Available Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v: any) => (
                    <div key={v.id} className="px-4 py-2 rounded-md border text-sm font-medium cursor-pointer hover:border-slate-400 transition-colors bg-slate-50">
                      {v.size && `Size: ${v.size} `}
                      {v.color && `Color: ${v.color}`}
                      {v.price_adjustment > 0 && ` (+৳${v.price_adjustment})`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-8">
              <Button size="lg" className="w-full text-base font-semibold h-14" style={{ backgroundColor: profile.theme_color }}>
                <ShoppingBag className="mr-2 h-5 w-5" /> Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
