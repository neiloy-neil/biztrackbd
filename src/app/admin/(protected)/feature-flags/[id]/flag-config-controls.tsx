'use client'

import { useState } from 'react'
import { toggleGlobalFeatureFlag, setFlagPlanEntitlement, addFlagOverride, removeFlagOverride } from '@/domains/admin/feature-flags'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Building, User, Loader2 } from 'lucide-react'

export function GlobalToggle({ flagId, isGlobalEnabled }: { flagId: string, isGlobalEnabled: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleToggle(checked: boolean) {
    setLoading(true)
    try {
      await toggleGlobalFeatureFlag({ id: flagId, isGlobalEnabled: checked })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
      <div className="space-y-1">
        <h3 className="font-medium text-slate-900">Global Status</h3>
        <p className="text-sm text-slate-500">Enable this feature for all users across the platform.</p>
      </div>
      <div className="flex items-center gap-3">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <Switch checked={isGlobalEnabled} onCheckedChange={handleToggle} disabled={loading} />
      </div>
    </div>
  )
}

export function PlanEntitlements({ flagId, plans, activePlanIds }: { flagId: string, plans: any[], activePlanIds: string[] }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleToggle(planId: string, checked: boolean) {
    setLoadingPlan(planId)
    try {
      await setFlagPlanEntitlement({ flagId, planId, enabled: checked })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Plan Entitlements</CardTitle>
        <CardDescription>Enable this feature for specific subscription plans.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plans.map(plan => {
          const isEnabled = activePlanIds.includes(plan.id)
          return (
            <div key={plan.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium">{plan.name}</div>
                <div className="text-xs text-slate-500">Includes all businesses on this plan</div>
              </div>
              <div className="flex items-center gap-3">
                {loadingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                <Switch 
                  checked={isEnabled} 
                  onCheckedChange={(c) => handleToggle(plan.id, c)} 
                  disabled={loadingPlan !== null}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function FlagOverrides({ flagId, overrides }: { flagId: string, overrides: any[] }) {
  const [targetType, setTargetType] = useState<'business' | 'user'>('business')
  const [targetId, setTargetId] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await addFlagOverride({ flagId, targetType, targetId, isEnabled })
      setTargetId('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    try {
      await removeFlagOverride({ overrideId: id, flagId })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Specific Overrides</CardTitle>
        <CardDescription>Force enable or disable this feature for specific businesses or users.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3 items-end p-4 bg-slate-50 border rounded-lg">
          <div className="space-y-2 w-full md:w-auto">
            <Label>Type</Label>
            <select 
              value={targetType} 
              onChange={e => setTargetType(e.target.value as any)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="business">Business</option>
              <option value="user">User</option>
            </select>
          </div>
          <div className="space-y-2 flex-1 w-full">
            <Label>Target ID (UUID)</Label>
            <Input 
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              placeholder={`Enter ${targetType} ID...`}
              required
            />
          </div>
          <div className="space-y-2 w-full md:w-auto">
            <Label>Action</Label>
            <select 
              value={isEnabled ? 'enable' : 'disable'} 
              onChange={e => setIsEnabled(e.target.value === 'enable')}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="enable">Force Enable</option>
              <option value="disable">Force Disable</option>
            </select>
          </div>
          <Button type="submit" disabled={loading || !targetId} className="w-full md:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Add'}
          </Button>
        </form>

        <div className="space-y-2">
          {overrides.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No active overrides.</p>
          ) : (
            overrides.map(override => (
              <div key={override.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3">
                  {override.target_type === 'business' ? <Building className="w-4 h-4 text-slate-400" /> : <User className="w-4 h-4 text-slate-400" />}
                  <div>
                    <div className="font-mono text-xs text-slate-900">{override.target_id}</div>
                    <div className="text-xs text-slate-500 capitalize">{override.target_type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {override.is_enabled ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Force Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Force Disabled</Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemove(override.id)}
                    disabled={removingId === override.id}
                  >
                    {removingId === override.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
