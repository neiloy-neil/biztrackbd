import { Settings } from 'lucide-react'
import { getPlatformSettings, getSystemEnvironmentStatus } from '@/domains/admin/settings.actions'
import { SettingsTabs } from './SettingsTabs'
import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Platform Settings | BizTrack Admin' }

export default async function AdminSettingsPage() {
  const supabase = await createAdminAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.settings.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  const settings = await getPlatformSettings()
  const systemStatusRes = await getSystemEnvironmentStatus()
  
  const systemStatus = systemStatusRes.success ? systemStatusRes.data : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          Platform Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure global application settings and API integrations.</p>
      </div>

      <SettingsTabs settings={settings} systemStatus={systemStatus} />
    </div>
  )
}
