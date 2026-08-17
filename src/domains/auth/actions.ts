'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'

const SMS_API_KEY = process.env.SMS_NET_BD_API_KEY
const SMS_ENDPOINT = 'https://api.sms.net.bd/sendsms'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return `880${digits.slice(1)}`
  return `880${digits}`
}

function deriveEmail(phone: string): string {
  return `${normalizePhone(phone)}@biztrack.internal`
}

import { headers } from 'next/headers'

// Determines where the user should go based on their business membership
async function getRedirectPath(userId: string): Promise<string> {
  const headersList = await headers()
  const referer = headersList.get('referer') || ''
  const host = headersList.get('host') || ''
  
  // Check if we are on pure localhost without subdomains
  const isLocalhost = host.includes('localhost') && !host.includes('app.localhost') && !host.includes('admin.localhost')

  const supabase = await createClient()

  // Check if they are a platform admin
  const { data: adminData } = await supabase
    .from('platform_admins')
    .select('role')
    .eq('user_id', userId)
    .single()

  // If Admin logging in via the admin portal
  if (adminData && referer.includes('/admin')) {
    return isLocalhost ? '/admin/dashboard' : '/dashboard'
  }

  // Not an admin, or Admin logging in via normal app portal -> go to app
  const appPrefix = isLocalhost ? '/app' : ''
  
  const { data: member } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', userId)
    .limit(1)
    .single()
    
  if (member) {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set('active_business_id', member.business_id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
    return `${appPrefix}/dashboard`
  }
  return `${appPrefix}/onboarding`
}

export async function checkUserExists(phone: string) {
  const normalizedPhone = normalizePhone(phone)
  const email = deriveEmail(normalizedPhone)

  const adminClient = await createAdminClient()
  
  // Quick hack: Try to create the user, if email exists it fails
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'TemporaryPassword123!',
    email_confirm: true,
  })

  if (data?.user) {
    // Clean up if it actually succeeded (meaning user didn't exist)
    await adminClient.auth.admin.deleteUser(data.user.id)
    return { exists: false }
  }

  if (error?.message.includes('already registered') || error?.code === 'user_already_exists') {
    return { exists: true }
  }

  // Fallback to true if we hit a weird error to be safe
  return { exists: true }
}

export async function loginWithPin(phone: string, pin: string) {
  const isRateLimited = await rateLimit('loginWithPin')
  if (isRateLimited) return { success: false, error: 'Too many requests. Please wait a minute.' }

  const normalizedPhone = normalizePhone(phone)
  const email = deriveEmail(normalizedPhone)
  
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pin
  })

  if (error || !data.user) {
    return { success: false, error: 'ভুল পিন। আবার চেষ্টা করুন। (Invalid PIN)' }
  }

  const redirectTo = await getRedirectPath(data.user.id)
  return { success: true, redirectTo }
}

async function sendSms(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  if (!SMS_API_KEY) {
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
  const otp = String(Math.floor(100000 + Math.random() * 900000))

  const adminClient = await createAdminClient()
  const { error: dbError } = await adminClient
    .from('phone_otps')
    .insert({ phone: normalizedPhone, otp, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })

  if (dbError) {
    console.error('OTP insert error:', dbError)
    return { success: false, error: 'Failed to generate OTP. Please try again.' }
  }

  const smsResult = await sendSms(normalizedPhone, otp)
  if (!smsResult.success) {
    return { success: false, error: smsResult.error || 'Failed to send SMS' }
  }

  return { success: true, phone: normalizedPhone }
}

export async function verifyOtpAndCreateUser(phone: string, token: string, pin: string) {
  const isRateLimited = await rateLimit('verifyOtp')
  if (isRateLimited) return { success: false, error: 'Too many requests. Please wait a minute.' }

  if (!pin || pin.length < 6) {
    return { success: false, error: 'আপনার পিন কমপক্ষে ৬ সংখ্যার হতে হবে।' }
  }

  const normalizedPhone = normalizePhone(phone)
  const adminClient = await createAdminClient()

  // Find unverified OTP
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

  // Create account with PIN
  const email = deriveEmail(normalizedPhone)
  
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { phone: normalizedPhone }
  })

  if (createError || !newUser) {
    return { success: false, error: 'Account creation failed: ' + createError?.message }
  }

  // Sign in with the newly created account
  const supabase = await createClient()
  const { error: finalSignInError } = await supabase.auth.signInWithPassword({ email, password: pin })
  
  if (finalSignInError) {
    return { success: false, error: finalSignInError.message }
  }
  
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isLocalhost = host.includes('localhost') && !host.includes('app.localhost') && !host.includes('admin.localhost')
  
  const appPrefix = isLocalhost ? '/app' : ''
  
  // Brand new user always goes to onboarding
  return { success: true, redirectTo: `${appPrefix}/onboarding` }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.delete('active_business_id')
  
  const headersList = await headers()
  const referer = headersList.get('referer') || ''
  const host = headersList.get('host') || ''
  const isLocalhost = host.includes('localhost') && !host.includes('app.localhost') && !host.includes('admin.localhost')
  
  if (isLocalhost) {
    redirect(referer.includes('/admin') ? '/admin/login' : '/app/login')
  } else {
    redirect('/login')
  }
}
