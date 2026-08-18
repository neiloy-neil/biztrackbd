import { createClient } from '@/lib/supabase/server'
import { PricingCards } from './PricingCards'

export async function PricingSection() {
  const supabase = await createClient()
  
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .order('price_monthly', { ascending: true })

  if (!plans || plans.length === 0) return null

  return <PricingCards plans={plans} />
}
