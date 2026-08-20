import { getStorefrontProfileBySlug, getStorefrontProducts } from '@/domains/storefront/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QuickAddToCartButton } from './components/QuickAddToCartButton'

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = await params
  const { slug } = resolvedParams

  const profileRes = await getStorefrontProfileBySlug(slug)
  if (!profileRes.success || !profileRes.data) notFound()
  const profile = profileRes.data

  const productsRes = await getStorefrontProducts(profile.business_id)
  const products = productsRes.success ? productsRes.data : []

  return (
    <div className="space-y-8">
      {profile.banner_url && (
        <div className="w-full h-48 md:h-64 lg:h-80 rounded-xl overflow-hidden shadow-sm relative">
          <img 
            src={profile.banner_url} 
            alt="Store Banner" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Our Products</h2>
        {!(products && products.length > 0) ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No products available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {(products || []).map((product: any) => (
              <Link key={product.id} href={`/store/${slug}/product/${product.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-slate-200">
                  <div className="aspect-square bg-slate-100 flex items-center justify-center p-6 text-slate-400 group-hover:bg-slate-200 transition-colors">
                    {/* Placeholder for Product Image */}
                    <span className="text-4xl">🛍️</span>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                      {product.category?.[0]?.name || 'Uncategorized'}
                    </div>
                    <h3 className="font-semibold text-slate-900 line-clamp-2 min-h-[3rem]">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between pt-2">
                      <div className="font-bold text-lg" style={{ color: profile.theme_color }}>
                        ৳{Number(product.online_price || 0).toLocaleString('en-IN')}
                      </div>
                      <QuickAddToCartButton product={product} themeColor={profile.theme_color} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
