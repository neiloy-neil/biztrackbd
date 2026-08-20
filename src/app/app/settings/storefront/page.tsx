import { Suspense } from 'react'
import { getStorefrontSettings } from '@/domains/storefront/owner-actions'
import { StorefrontSettingsForm } from '@/domains/storefront/components/StorefrontSettingsForm'
import { Loader2 } from 'lucide-react'

export default async function StorefrontSettingsPage() {
  const settingsRes = await getStorefrontSettings()
  const initialData = settingsRes.success ? settingsRes.data : null

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Online Storefront</h2>
      </div>

      <div className="mx-auto max-w-2xl bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Store Configuration</h3>
        <p className="text-sm text-gray-500 mb-6">
          Enable your public storefront so customers can browse your catalog and place orders online.
        </p>

        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}>
          <StorefrontSettingsForm initialData={initialData} />
        </Suspense>
      </div>
    </div>
  )
}
