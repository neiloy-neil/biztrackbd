import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import POSClient from '@/domains/pos/components/POSClient'

export const dynamic = 'force-dynamic'

export default async function POSPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const businessId = cookieStore.get('active_business_id')?.value
  
  if (!businessId) {
    redirect('/login')
  }

  // Fetch Business Profile
  const { data: business } = await supabase
    .from('businesses')
    .select('name, phone, address, district')
    .eq('id', businessId)
    .single()

  // Fetch Products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name')

  // Fetch Accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  // Fetch Customers
  const { data: customers } = await supabase
    .from('parties')
    .select('id, name, phone')
    .eq('business_id', businessId)
    .eq('type', 'customer')
    .is('deleted_at', null)

  // Fetch Branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  return (
    <div className="h-screen w-full bg-slate-100 flex overflow-hidden">
      <Suspense fallback={<div className="flex items-center justify-center h-full w-full">Loading POS...</div>}>
        <POSClient
          initialProducts={products || []}
          accounts={accounts || []}
          customers={customers || []}
          branches={branches || []}
          businessName={business?.name || 'BizTrack BD'}
          businessPhone={business?.phone || ''}
          businessAddress={[business?.address, business?.district].filter(Boolean).join(', ')}
        />
      </Suspense>
    </div>
  )
}
