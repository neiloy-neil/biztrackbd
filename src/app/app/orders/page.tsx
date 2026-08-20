import { Suspense } from 'react'
import { getOnlineOrders } from '@/domains/orders/actions'
import { OrderList } from '@/domains/orders/components/OrderList'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getActiveCouriers() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) return []

  const { data } = await supabase
    .from('business_integrations')
    .select('provider')
    .eq('business_id', businessId)
    .eq('is_active', true)

  return data?.map(d => d.provider) || []
}

async function getAccounts() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value

  if (!businessId) return []

  const { data } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name')

  return data || []
}

export default async function OrdersPage() {
  const ordersRes = await getOnlineOrders()
  const orders = ordersRes.success ? ordersRes.data : []
  const activeCouriers = await getActiveCouriers()
  const accounts = await getAccounts()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Online Orders</h2>
      </div>

      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}>
        <OrderList initialOrders={orders || []} activeCouriers={activeCouriers} accounts={accounts} />
      </Suspense>
    </div>
  )
}

