'use server'

import { createClient } from '@/lib/supabase/server'
import { ROLE_PERMISSIONS, hasPermission } from '@/lib/actions/safe-action'

export async function getClientPermissions() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const activeBusinessId = cookieStore.get('active_business_id')?.value

  if (!activeBusinessId) return { role: null, permissions: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { role: null, permissions: [] }

  const { data: member } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_id', activeBusinessId)
    .eq('user_id', user.id)
    .single()

  if (!member) return { role: null, permissions: [] }

  const role = member.role
  const permissions = role === 'owner' ? ['*'] : ROLE_PERMISSIONS[role] || []

  return { role, permissions }
}
