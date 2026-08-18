import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PreferencesForm from './preferences-form'

export default async function NotificationPreferencesPage() {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.settings.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  let { data: preferences } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  // If no preferences exist, default to everything enabled
  if (!preferences) {
    preferences = {
      email_notifications: true,
      muted_types: []
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/admin/notifications" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Inbox
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Preferences</h1>
        <p className="text-slate-500 mt-1">Control how and when you receive system alerts.</p>
      </div>

      <PreferencesForm 
        initialEmail={preferences.email_notifications} 
        initialMuted={preferences.muted_types} 
      />
    </div>
  )
}
