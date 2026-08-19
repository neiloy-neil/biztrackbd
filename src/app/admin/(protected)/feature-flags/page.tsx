import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flag, Search, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import CreateFlagForm from './create-flag-form'

export default async function FeatureFlagsPage({
  searchParams
}: {
  searchParams: { q?: string }
}) {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.settings.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  const query = searchParams.q || ''

  let dbQuery = supabase
    .from('feature_flags')
    .select('*, feature_flag_plans(count), feature_flag_overrides(count)')
    .order('id', { ascending: true })

  if (query) {
    dbQuery = dbQuery.ilike('id', `%${query}%`)
  }

  const { data: flags } = await dbQuery

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Feature Flags</h1>
          <p className="text-slate-500">Manage global features, plan entitlements, and specific overrides.</p>
        </div>
        <CreateFlagForm />
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              name="q"
              defaultValue={query}
              placeholder="Search flags..." 
              className="pl-9 w-[300px]"
            />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Flag ID</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Global Status</th>
                <th className="px-6 py-4 font-medium">Plans / Overrides</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flags?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Flag className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    No feature flags found.
                  </td>
                </tr>
              ) : (
                flags?.map((flag: any) => (
                  <tr key={flag.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-slate-900 font-medium">
                      {flag.id}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {flag.description}
                    </td>
                    <td className="px-6 py-4">
                      {flag.is_global_enabled ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 gap-1">
                          <XCircle className="w-3 h-3" /> Disabled
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Badge variant="secondary">{flag.feature_flag_plans[0].count} Plans</Badge>
                        <Badge variant="secondary">{flag.feature_flag_overrides[0].count} Overrides</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/feature-flags/${flag.id}`}>
                        <Button variant="ghost" size="sm">
                          Configure
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
