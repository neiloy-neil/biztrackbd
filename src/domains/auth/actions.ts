'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'

export async function sendOtp(phone: string) {
  const isRateLimited = await rateLimit('sendOtp')
  if (isRateLimited) {
    return { success: false, error: 'Too many requests. Please wait a minute.' }
  }

  // Format phone number
  const formattedPhone = phone.startsWith('+880') ? phone : `+880${phone.replace(/^0+/, '')}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, formattedPhone }
}

export async function verifyOtp(phone: string, token: string) {
  const isRateLimited = await rateLimit('verifyOtp')
  if (isRateLimited) {
    return { success: false, error: 'Too many requests. Please wait a minute.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Authentication successful. Route to dashboard or onboarding via Middleware.
  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
