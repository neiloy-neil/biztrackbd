import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GlobalToggle, PlanEntitlements, FlagOverrides } from './flag-config-controls'

export default async function FeatureFlagConfigPage({ params }: { params: { id: string } }) {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.settings.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  // Fetch flag details
  const { data: flag, error } = await supabase
    .from('feature_flags')
    .select('*, feature_flag_plans(plan_id), feature_flag_overrides(*)')
    .eq('id', params.id)
    .single()

  if (error || !flag) {
    redirect('/admin/feature-flags')
  }

  // Fetch all subscription plans
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name')
    .order('price_monthly', { ascending: true })

  const activePlanIds = flag.feature_flag_plans.map((p: any) => p.plan_id)
  
  // Sort overrides so business overrides appear before user overrides
  const overrides = flag.feature_flag_overrides.sort((a: any, b: any) => {
    if (a.target_type === b.target_type) return 0
    return a.target_type === 'business' ? -1 : 1
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/admin/feature-flags" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Feature Flags
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{flag.id}</h1>
        <p className="text-slate-500 mt-1">{flag.description}</p>
      </div>

      <div className="space-y-6">
        <GlobalToggle flagId={flag.id} isGlobalEnabled={flag.is_global_enabled} />
        
        <PlanEntitlements flagId={flag.id} plans={plans || []} activePlanIds={activePlanIds} />
        
        <FlagOverrides flagId={flag.id} overrides={overrides} />
      </div>
    </div>
  )
}
