'use client'

import { PowerOff, Power, Ban, Settings2, LogOut } from 'lucide-react'
import { suspendUserAction, reactivateUserAction, forceLogoutUserAction } from '@/domains/admin/actions'
import { useRouter } from 'next/navigation'

export function UserActionsMenu({ userId, status }: { userId: string, status: string }) {
  const router = useRouter()

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this user?')) return
    await suspendUserAction({ userId, reason: 'Admin action' })
  }

  const handleReactivate = async () => {
    await reactivateUserAction({ userId, reason: 'Admin action' })
  }

  const handleForceLogout = async () => {
    if (!confirm('Force logout this user from all sessions?')) return
    await forceLogoutUserAction({ userId, reason: 'Admin action' })
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium text-sm">
        <Settings2 className="h-4 w-4" /> Manage Access
      </button>
      
      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
        <div className="p-2 space-y-1">
          <button 
            onClick={handleForceLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Force Logout
          </button>
          
          <div className="h-px bg-gray-200 my-1"></div>
          
          {status === 'active' || status === 'inactive' || status === 'unverified' ? (
            <button 
              onClick={handleSuspend}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 font-medium"
            >
              <PowerOff className="h-4 w-4" /> Suspend Account
            </button>
          ) : (
            <button 
              onClick={handleReactivate}
              className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-md flex items-center gap-2 font-medium"
            >
              <Power className="h-4 w-4" /> Reactivate Account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
