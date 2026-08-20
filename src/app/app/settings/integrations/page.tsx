import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Loader2 } from 'lucide-react'
import { CourierIntegrationsForm } from '@/domains/orders/components/CourierIntegrationsForm'

async function getIntegrations() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) return []

  const { data } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', businessId)

  return data || []
}

export default async function IntegrationsSettingsPage() {
  const integrations = await getIntegrations()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Courier Integrations</h2>
      </div>

      <div className="mx-auto max-w-2xl bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Delivery Partners</h3>
        <p className="text-sm text-gray-500 mb-6">
          Connect your Steadfast or Pathao accounts to automatically generate shipping labels and track deliveries from the Orders dashboard.
        </p>

        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}>
          <CourierIntegrationsForm initialData={integrations} />
        </Suspense>
      </div>
    </div>
  )
}
