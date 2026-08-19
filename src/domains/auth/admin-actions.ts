'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// We use the SAME Supabase project but different cookie keys
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function createAdminAuthClient() {
  const cookieStore = await cookies()
  const { getPlatformSettingsCached } = await import('@/lib/settings')
  const settings = await getPlatformSettingsCached()
  const adminSessionHours = settings?.security?.adminSessionDuration || 24

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
    cookieOptions: {
      name: 'sb-admin-auth-token',
      maxAge: adminSessionHours * 60 * 60
    }
  })
}

export async function loginAdminWithEmail(email: string, pin: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Database is not configured.' }
  }

  const supabase = await createAdminAuthClient()
  
  // Authenticate against the PRIMARY project
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pin
  })

  if (error || !data.user || !data.session) {
    return { success: false, error: 'Invalid admin credentials' }
  }

  // After authenticating, check if the user is ACTUALLY an admin
  const { data: adminData } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', data.user.id)
    .single()

  if (!adminData) {
    // Revoke the admin token if they are not an admin
    await supabase.auth.signOut()
    return { success: false, error: 'Unauthorized: Not a platform admin.' }
  }

  return { success: true, redirectTo: '/admin/dashboard' }
}

export async function logoutAdmin() {
  const supabase = await createAdminAuthClient()
  await supabase.auth.signOut()
  return { success: true, redirectTo: '/admin/login' }
}
