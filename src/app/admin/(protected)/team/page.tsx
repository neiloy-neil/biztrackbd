import { Shield } from 'lucide-react'
import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import { fetchPlatformAdminsAction } from '@/domains/admin/team.actions'
import { AdminTeamClient } from './AdminTeamClient'

export const metadata = { title: 'Platform Team | BizTrack Admin' }

export default async function AdminTeamPage() {
  const supabase = await createAdminAuthClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.admins.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  // Using the wrapper directly since it requires authorization, we pass empty params
  // Wait, fetchPlatformAdminsAction takes an empty object or nothing. Let's cast or pass {}
  // Since it's a server action wrapper, it expects standard Next parameters or just undefined.
  // Actually, we can just call it like this:
  const res = await fetchPlatformAdminsAction(undefined as any)
  const admins = res?.success ? res.data : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-600" />
          Admin Team Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage super admins, support, and billing staff.</p>
      </div>

      <AdminTeamClient admins={admins} currentUserEmail={user.email || ''} />
    </div>
  )
}
