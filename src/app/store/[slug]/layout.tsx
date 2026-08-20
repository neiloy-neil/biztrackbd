import { getStorefrontProfileBySlug } from '@/domains/storefront/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { StorefrontCartDrawer } from './components/StorefrontCartDrawer'

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = await params
  const { slug } = resolvedParams

  const profileRes = await getStorefrontProfileBySlug(slug)
  
  if (!profileRes.success || !profileRes.data) {
    notFound()
  }

  const profile = profileRes.data
  const business = profile.business

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Store Header */}
      <header 
        className="sticky top-0 z-50 shadow-sm text-white"
        style={{ backgroundColor: profile.theme_color }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/store/${slug}`} className="flex items-center space-x-3">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt={business.name} className="h-8 w-8 rounded-full object-cover bg-white" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-white text-black flex items-center justify-center font-bold">
                  {business.name.charAt(0)}
                </div>
              )}
              <span className="font-bold text-lg tracking-tight">{business.name}</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <StorefrontCartDrawer slug={slug} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          <p className="font-medium text-slate-900">{business.name}</p>
          <p>{business.phone}</p>
          <p>{business.address}</p>
          <p className="mt-4 text-xs">Powered by BizTrack BD</p>
        </div>
      </footer>
    </div>
  )
}
