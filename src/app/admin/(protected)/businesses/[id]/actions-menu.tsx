'use client'

import { CreditCard, PowerOff, Power, Ban, Settings2 } from 'lucide-react'
import { suspendBusinessAction, reactivateBusinessAction, deleteBusinessAction } from '@/domains/admin/actions'
import { useRouter } from 'next/navigation'

export function ActionsMenu({ businessId, status }: { businessId: string, status: string }) {
  const router = useRouter()

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this business?')) return
    await suspendBusinessAction({ businessId, reason: 'Admin action' })
  }

  const handleReactivate = async () => {
    await reactivateBusinessAction({ businessId, reason: 'Admin action' })
  }

  const handleDelete = async () => {
    if (!confirm('DANGER: Are you sure you want to delete this business? This action requires super admin privileges and will be strictly audited.')) return
    await deleteBusinessAction({ businessId, reason: 'Admin deletion' })
    router.push('/admin/businesses')
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium text-sm">
        <Settings2 className="h-4 w-4" /> Manage Tenant
      </button>
      
      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
        <div className="p-2 space-y-1">
          <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Change Plan
          </button>
          
          {status === 'active' ? (
            <button 
              onClick={handleSuspend}
              className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-md flex items-center gap-2"
            >
              <PowerOff className="h-4 w-4" /> Suspend Business
            </button>
          ) : (
            <button 
              onClick={handleReactivate}
              className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-md flex items-center gap-2"
            >
              <Power className="h-4 w-4" /> Reactivate Business
            </button>
          )}
          
          <div className="h-px bg-gray-200 my-1"></div>
          
          <button 
            onClick={handleDelete}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 font-medium"
          >
            <Ban className="h-4 w-4" /> Delete Business
          </button>
        </div>
      </div>
    </div>
  )
}
