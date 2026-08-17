import { fetchPlatformUserDetail } from '@/domains/admin/actions'
import { notFound } from 'next/navigation'
import { 
  Building2, MapPin, CreditCard, Activity, 
  ShieldAlert, Settings2, MoreVertical, 
  AlertTriangle, Power, PowerOff, Ban, UserIcon, Phone, Mail, Clock
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { UserActionsMenu } from './actions-menu'
import Link from 'next/link'

export default async function UserDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const response = await fetchPlatformUserDetail({ userId: id })
  const data = response.success ? response.data : null

  if (!data || !data.user) {
    notFound()
  }

  const { user, businesses, sessions, recent_audits } = data

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{user.email || user.phone || 'Unknown User'}</h1>
            <Badge variant={user.status === 'active' ? 'default' : user.status === 'suspended' ? 'destructive' : 'secondary'}>
              {user.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1 font-mono">ID: {user.id}</p>
        </div>
        
        {/* Actions Menu */}
        <UserActionsMenu userId={user.id} status={user.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-indigo-500" /> User Profile
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</div>
                <div className="text-sm font-medium text-gray-900">{user.email || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</div>
                <div className="text-sm font-medium text-gray-900">{user.phone || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Created</div>
                <div className="text-sm font-medium text-gray-900">{new Date(user.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Activity className="h-3 w-3" /> Last Sign In</div>
                <div className="text-sm font-medium text-gray-900">
                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </div>

          {/* Business Memberships */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500" /> Business Memberships
              </h3>
              <Badge variant="secondary">{businesses?.length || 0}</Badge>
            </div>
            <div className="p-0">
              {businesses && businesses.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {businesses.map((biz: any, idx: number) => (
                    <li key={idx} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{biz.business_name}</div>
                        <div className="text-xs text-gray-500 mt-1 font-mono">Business ID: {biz.business_id.split('-')[0]}...</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="outline" className="capitalize">{biz.role}</Badge>
                          <div className="text-xs text-gray-400 mt-1">Since {new Date(biz.joined_at).toLocaleDateString()}</div>
                        </div>
                        <Link href={`/admin/businesses/${biz.business_id}`} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-2 rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  This user does not belong to any businesses.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Active Sessions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Power className="h-4 w-4 text-emerald-500" /> Active Sessions
              </h3>
            </div>
            <div className="p-4">
              {sessions && sessions.length > 0 ? (
                <div className="space-y-4">
                  {sessions.map((session: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-emerald-500 pl-3">
                      <div className="text-xs font-mono text-gray-500 mb-1 break-all">ID: {session.id}</div>
                      <div className="text-xs text-gray-600">Created: {new Date(session.created_at).toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Expires: {new Date(session.not_after).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">No active sessions.</div>
              )}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <h3 className="font-semibold text-gray-900">Platform Activity</h3>
            </div>
            <div className="p-0">
              {recent_audits && recent_audits.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {recent_audits.map((audit: any, idx: number) => (
                    <li key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{audit.action}</span>
                        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-2 font-mono break-all">
                        Context: {audit.entity_type}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  No direct platform activity logged for this user.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
