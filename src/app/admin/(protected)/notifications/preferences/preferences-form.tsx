'use client'

import { useState } from 'react'
import { updateNotificationPreferences } from '@/domains/admin/notifications'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const NOTIFICATION_TYPES = [
  { id: 'business_created', label: 'New Business Created', description: 'When a new tenant signs up.' },
  { id: 'subscription_paid', label: 'New Paid Subscription', description: 'When a business upgrades to a paid plan.' },
  { id: 'payment_failed', label: 'Failed Payment', description: 'When a renewal charge fails.' },
  { id: 'subscription_cancelled', label: 'Subscription Cancellation', description: 'When a business cancels their plan.' },
  { id: 'trial_expiring', label: 'Trial Expiring', description: 'When a business is near the end of their trial.' },
  { id: 'high_error_rate', label: 'High Error Rate', description: 'System alert for increased API failures.' },
  { id: 'storage_warning', label: 'Storage Warning', description: 'System alert for approaching storage limits.' },
  { id: 'sync_failure', label: 'Sync Failures', description: 'When a background sync job fails.' },
  { id: 'security_event', label: 'Security Events', description: 'Suspicious logins or audit anomalies.' },
  { id: 'support_ticket', label: 'Support Tickets', description: 'When a new support ticket is opened.' },
  { id: 'system_incident', label: 'System Incidents', description: 'Critical infrastructure alerts.' },
]

export default function PreferencesForm({ 
  initialEmail, 
  initialMuted 
}: { 
  initialEmail: boolean, 
  initialMuted: string[] 
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmail)
  const [mutedTypes, setMutedTypes] = useState<string[]>(initialMuted)
  const [loading, setLoading] = useState(false)

  const handleToggleMute = (typeId: string, checked: boolean) => {
    // If checked, it means they WANT notifications, so we REMOVE it from muted
    // If unchecked, they DON'T want it, so we ADD it to muted
    if (checked) {
      setMutedTypes(prev => prev.filter(t => t !== typeId))
    } else {
      setMutedTypes(prev => [...prev, typeId])
    }
  }

  async function handleSave() {
    setLoading(true)
    try {
      await updateNotificationPreferences(emailEnabled, mutedTypes)
      alert('Preferences saved successfully.')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delivery Methods</CardTitle>
          <CardDescription>How would you like to receive notifications?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-0.5">
              <Label className="text-base">Email Notifications</Label>
              <div className="text-sm text-slate-500">Receive a daily digest of important events.</div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Types</CardTitle>
          <CardDescription>Select which events should appear in your inbox. Turn off noise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-slate-100">
          {NOTIFICATION_TYPES.map(type => {
            const isEnabled = !mutedTypes.includes(type.id)
            return (
              <div key={type.id} className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-slate-900">{type.label}</Label>
                  <div className="text-sm text-slate-500">{type.description}</div>
                </div>
                <Switch checked={isEnabled} onCheckedChange={(c) => handleToggleMute(type.id, c)} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} size="lg">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
