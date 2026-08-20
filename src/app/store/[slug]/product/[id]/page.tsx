import { getStorefrontProfileBySlug, getStorefrontProducts } from '@/domains/storefront/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { ProductDetailClient } from './components/ProductDetailClient'

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

          <ProductDetailClient product={product} themeColor={profile.theme_color} />
        </div>
      </div>
    </div>
  )
}
