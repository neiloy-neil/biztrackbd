'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function startCheckoutIntent(planId: string, cycle: 'monthly' | 'annual') {
  // Save the intent as a cookie so it survives signup/onboarding
  const cookieStore = await cookies()
  cookieStore.set('checkout_intent', JSON.stringify({ planId, cycle }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours
  })

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/app/checkout')
  } else {
    redirect('/app/login')
  }
}
