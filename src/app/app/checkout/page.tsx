import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckoutForm } from './CheckoutForm'

export default async function CheckoutPage() {
  const cookieStore = await cookies()
  const intentCookie = cookieStore.get('checkout_intent')?.value

  if (!intentCookie) {
    redirect('/app/dashboard')
  }

  let intent
  try {
    intent = JSON.parse(intentCookie)
  } catch (e) {
    redirect('/app/dashboard')
  }

  const supabase = await createClient()
  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', intent.planId)
    .single()

  if (!plan) {
    redirect('/app/dashboard')
  }

  if (plan.price_monthly === 0) {
    redirect('/app/dashboard')
  }

  const baseAmount = intent.cycle === 'annual' ? plan.price_yearly : plan.price_monthly

  // Safely extract limits to use as features
  const features = []
  if (plan.limits) {
    if (plan.limits.branches > 1) features.push(`${plan.limits.branches} Branches`)
    else if (plan.limits.branches === 1) features.push(`1 Branch`)
    
    if (plan.limits.staff_per_branch > 1) features.push(`${plan.limits.staff_per_branch} Staff per Branch`)
    else if (plan.limits.staff_per_branch === 1) features.push(`1 Staff per Branch`)
    
    if (plan.limits.inventory_items) features.push(`Up to ${plan.limits.inventory_items} Inventory Items`)
    else features.push(`Unlimited Inventory Items`)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Complete your checkout</h1>
        <p className="mt-2 text-slate-500">Review your subscription details below.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl p-6 md:p-8">
        <CheckoutForm 
          planId={plan.id} 
          planName={plan.name}
          cycle={intent.cycle} 
          baseAmount={baseAmount} 
          features={features}
        />
      </div>
    </div>
  )
}
