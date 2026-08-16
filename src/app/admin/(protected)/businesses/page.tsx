import { fetchBusinessesList } from '@/domains/admin/actions'
import Link from 'next/link'
import { Search, Filter, MoreVertical, Eye, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const status = typeof params.status === 'string' ? params.status : ''
  const plan = typeof params.plan === 'string' ? params.plan : ''

  const businesses = await fetchBusinessesList(q, status, plan)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-indigo-600" />
            Business Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage tenant accounts, subscriptions, and platform access</p>
        </div>
      </div>

      {/* Filters and Search - Client-side navigation handled via forms or direct links */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <form className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="q" className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Business name, phone, ID..."
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="plan" className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
            <select
              id="plan"
              name="plan"
              defaultValue={plan}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
            >
              <option value="">All Plans</option>
              <option value="Free / No Plan">Free</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors">
            Filter
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan & Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform Status</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No businesses found matching your criteria.
                  </td>
                </tr>
              ) : businesses.map((business: any) => (
                <tr key={business.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{business.name}</span>
                      <span className="text-xs text-gray-500 font-mono mt-1">ID: {business.id.split('-')[0]}...</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{business.owner_phone || 'N/A'}</div>
                    <div className="text-xs text-gray-500">Joined: {new Date(business.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{business.plan_name}</div>
                    <Badge variant={business.subscription_status === 'active' ? 'default' : business.subscription_status === 'trialing' ? 'secondary' : 'destructive'} className="mt-1">
                      {business.subscription_status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{business.user_count} Users</div>
                    <div>{business.branch_count} Branches</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={business.status === 'active' ? 'outline' : 'destructive'}>
                      {business.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/businesses/${business.id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1">
                      <Eye className="h-4 w-4" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
