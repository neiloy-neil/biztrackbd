import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, CreditCard, Settings, LogOut, Tag, Activity, HeadphonesIcon, Flag, Bell, Shield } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminClient = await createAdminAuthClient()
  const { data: { user }, error } = await adminClient.auth.getUser()
  
  if (error || !user) {
    // Invalid or expired admin token
    redirect('/admin/login')
  }

  // We are safely authenticated as an admin on the PRIMARY Supabase project.
  // We can use createClient() or adminClient (they hit the same DB) 
  // to fetch data, but using createClient is standard for data fetching.
  const supabase = await createClient()

  const { count: unreadCount } = await supabase
    .from('platform_notifications')
    .select('*', { count: 'estimated', head: true }) // PERF-02: estimated avoids full table scan
    .eq('is_read', false)
    
  const { data: hasTeamPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.admins.manage' })

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight">BizTrack Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Platform Control Plane</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/admin/dashboard" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          <Link href="/admin/users" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Users size={20} />
            <span>Users</span>
          </Link>
          <Link href="/admin/businesses" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Users size={20} />
            <span>Businesses</span>
          </Link>
          <Link href="/admin/billing" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <CreditCard size={20} />
            <span>Billing & Plans</span>
          </Link>
          <Link href="/admin/promotions" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Tag size={20} />
            <span>Promotions</span>
          </Link>
          <Link href="/admin/settings" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Settings size={20} />
            <span>Platform Settings</span>
          </Link>
          {hasTeamPermission && (
            <Link href="/admin/team" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
              <Shield size={20} />
              <span>Platform Team</span>
            </Link>
          )}
          <Link href="/admin/support" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <HeadphonesIcon size={20} />
            <span>Support Tickets</span>
          </Link>
          <Link href="/admin/feature-flags" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Flag size={20} />
            <span>Feature Flags</span>
          </Link>
          <Link href="/admin/notifications" className="flex items-center justify-between text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <div className="flex items-center space-x-3">
              <Bell size={20} />
              <span>Notifications</span>
            </div>
            {unreadCount !== null && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/admin/audit-logs" className="flex items-center space-x-3 text-gray-300 hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg transition-colors">
            <Activity size={20} />
            <span>Audit Logs</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {user.email}
            </div>
          </div>
          <form action={async () => {
            'use server'
            const { logoutAdmin } = await import('@/domains/auth/admin-actions')
            await logoutAdmin()
          }} className="mt-4">
            <button className="flex w-full items-center space-x-3 text-gray-400 hover:text-white transition-colors">
              <LogOut size={20} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto py-8 px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
