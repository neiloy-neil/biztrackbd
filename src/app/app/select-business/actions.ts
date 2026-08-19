'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function setActiveBusinessAction(businessId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Verify membership
  const { data: member } = await supabase
    .from('business_members')
    .select('id, businesses!inner(status)')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single()

  if (!member) {
    return { success: false, error: 'Unauthorized business access' }
  }

  const status = (member.businesses as any).status
  
  const { getPlatformSettingsCached } = await import('@/lib/settings')
  const settings = await getPlatformSettingsCached()
  const businessSessionHours = settings?.security?.businessSessionDuration || 168

  const cookieStore = await cookies()
  cookieStore.set('active_business_id', businessId, {
    path: '/',
    maxAge: businessSessionHours * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  })

  // We don't redirect here directly because we might need to handle suspended states
  return { success: true, status }
}
