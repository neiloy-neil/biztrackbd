'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'

const SMS_API_KEY = process.env.SMS_NET_BD_API_KEY || process.env.NEXT_PUBLIC_SMS_NET_BD_API_KEY
const SMS_ENDPOINT = 'https://api.sms.net.bd/sendsms'

function normalizePhone(phone: string): string {
  // Strip spaces/dashes, ensure format is 8801XXXXXXXXX
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return `880${digits.slice(1)}`
  return `880${digits}`
}

function deriveEmail(phone: string): string {
  return `${normalizePhone(phone)}@biztrack.internal`
}

function derivePassword(phone: string): string {
  // Deterministic password from phone + a server-side secret
  const secret = process.env.AUTH_INTERNAL_SECRET || 'biztrack-internal-secret-2024'
  return `${normalizePhone(phone)}-${secret}`
}

async function sendSms(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  if (!SMS_API_KEY) {
    // In development/testing, just log the OTP
    console.log(`[DEV MODE] OTP for ${phone}: ${otp}`)
    return { success: true }
  }

  const msg = `আপনার BizTrack BD ওটিপি: ${otp}। ১০ মিনিটের মধ্যে ব্যবহার করুন।`
  const formData = new URLSearchParams()
  formData.append('api_key', SMS_API_KEY)
  formData.append('msg', msg)
  formData.append('to', phone)

  try {
    const response = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    })
    const data = await response.json()
    if (data.error !== 0) {
      return { success: false, error: data.msg || 'SMS sending failed' }
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function sendOtp(phone: string) {
  const isRateLimited = await rateLimit('sendOtp')
  if (isRateLimited) return { success: false, error: 'Too many requests. Please wait a minute.' }

  const normalizedPhone = normalizePhone(phone)
  
  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000))

  // Use admin client to bypass RLS (user is not authenticated yet)
  const adminClient = await createAdminClient()
  const { error: dbError } = await adminClient
    .from('phone_otps')
    .insert({ phone: normalizedPhone, otp, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })

  if (dbError) {
    console.error('OTP insert error:', dbError)
    return { success: false, error: 'Failed to generate OTP. Please try again.' }
  }

  // Send SMS
  const smsResult = await sendSms(normalizedPhone, otp)
  if (!smsResult.success) {
    return { success: false, error: smsResult.error || 'Failed to send SMS' }
  }

  return { success: true, phone: normalizedPhone }
}

export async function verifyOtp(phone: string, token: string) {
  const isRateLimited = await rateLimit('verifyOtp')
  if (isRateLimited) return { success: false, error: 'Too many requests. Please wait a minute.' }

  const normalizedPhone = normalizePhone(phone)
  // Use admin client - user is not authenticated yet
  const adminClient = await createAdminClient()

  // Find the most recent unverified OTP for this phone
  const { data: otpRecord, error: fetchError } = await adminClient
    .from('phone_otps')
    .select('*')
    .eq('phone', normalizedPhone)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !otpRecord) {
    return { success: false, error: 'OTP মেয়াদ শেষ হয়েছে। পুনরায় চেষ্টা করুন।' }
  }

  // Increment attempts
  await adminClient
    .from('phone_otps')
    .update({ attempts: (otpRecord.attempts || 0) + 1 })
    .eq('id', otpRecord.id)

  if ((otpRecord.attempts || 0) >= 5) {
    return { success: false, error: 'অনেকবার ভুল চেষ্টা হয়েছে। নতুন OTP পাঠান।' }
  }

  if (otpRecord.otp !== token.trim()) {
    return { success: false, error: 'ভুল OTP। আবার চেষ্টা করুন।' }
  }

  // Mark OTP as verified
  await adminClient
    .from('phone_otps')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', otpRecord.id)

  // Now sign user in (or create account) using derived credentials
  const email = deriveEmail(normalizedPhone)
  const password = derivePassword(normalizedPhone)

  // Try to sign in first
  const supabase = await createClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInData?.user) {
    return { success: true }
  }

  // If sign in failed (user doesn't exist), create the account
  if (signInError) {
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone: normalizedPhone }
    })

    if (createError || !newUser) {
      return { success: false, error: 'Account creation failed: ' + createError?.message }
    }

    // Now sign in with the newly created account
    const { error: finalSignInError } = await supabase.auth.signInWithPassword({ email, password })
    if (finalSignInError) {
      return { success: false, error: finalSignInError.message }
    }
  }

  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
