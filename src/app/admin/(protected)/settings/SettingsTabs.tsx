'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { updatePlatformSetting } from '@/domains/admin/settings.actions'
import { SmsGatewayTester } from './sms-tester'

export function SettingsTabs({ 
  settings, 
  systemStatus 
}: { 
  settings: Record<string, any>
  systemStatus: Record<string, any>
}) {
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'auth', label: 'Authentication' },
    { id: 'billing', label: 'Billing' },
    { id: 'security', label: 'Security' },
    { id: 'communication', label: 'Communications' },
    { id: 'system', label: 'System' },
  ]

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 flex-shrink-0">
        <nav className="flex space-x-2 md:flex-col md:space-x-0 md:space-y-1 overflow-x-auto pb-2 md:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 max-w-3xl">
        {activeTab === 'general' && <GeneralSettings data={settings['general']} />}
        {activeTab === 'auth' && <AuthSettings data={settings['auth_limits']} />}
        {activeTab === 'billing' && <BillingSettings data={settings['billing']} />}
        {activeTab === 'security' && <SecuritySettings data={settings['security']} />}
        {activeTab === 'communication' && <CommunicationSettings systemStatus={systemStatus} />}
        {activeTab === 'system' && <SystemSettings systemStatus={systemStatus} />}
      </div>
    </div>
  )
}

function SettingsForm({ 
  settingKey, 
  title, 
  description, 
  defaultData, 
  children 
}: { 
  settingKey: string, 
  title: string, 
  description: string, 
  defaultData: any, 
  children: React.ReactNode 
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function action(formData: FormData) {
    setLoading(true)
    setMessage('')
    
    // Convert all form data to a JSON object
    const data: Record<string, any> = {}
    formData.forEach((val, key) => {
      // Basic type inference
      if (!isNaN(Number(val as string))) {
        data[key] = Number(val)
      } else if (val === 'true' || val === 'false') {
        data[key] = val === 'true'
      } else {
        data[key] = val
      }
    })

    const payload = new FormData()
    payload.append('key', settingKey)
    payload.append('value', JSON.stringify(data))

    const res = await updatePlatformSetting(payload)
    if (res?.success) {
      setMessage('Settings updated successfully.')
    } else {
      setMessage(res?.error || 'Failed to update settings.')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          {children}
          
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            {message && (
              <p className={`text-sm ${message.includes('success') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function GeneralSettings({ data = {} }: { data: any }) {
  return (
    <SettingsForm 
      settingKey="general"
      title="General Settings"
      description="Basic configuration for the BizTrack platform."
      defaultData={data}
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="platformName">Platform Name</Label>
          <Input id="platformName" name="platformName" defaultValue={data.platformName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportEmail">Support Email</Label>
          <Input id="supportEmail" name="supportEmail" defaultValue={data.supportEmail} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportPhone">Support Phone</Label>
          <Input id="supportPhone" name="supportPhone" defaultValue={data.supportPhone} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="defaultCurrency">Default Currency</Label>
            <Input id="defaultCurrency" name="defaultCurrency" defaultValue={data.defaultCurrency} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultTimezone">Default Timezone</Label>
            <Input id="defaultTimezone" name="defaultTimezone" defaultValue={data.defaultTimezone} />
          </div>
        </div>
      </div>
    </SettingsForm>
  )
}

function AuthSettings({ data = {} }: { data: any }) {
  return (
    <SettingsForm 
      settingKey="auth_limits"
      title="Authentication Limits"
      description="Configure OTP and login rate limits."
      defaultData={data}
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="otpExpiryMinutes">OTP Expiry (Minutes)</Label>
          <Input id="otpExpiryMinutes" name="otpExpiryMinutes" type="number" defaultValue={data.otpExpiryMinutes} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxOtpAttempts">Max OTP Attempts per Hour</Label>
          <Input id="maxOtpAttempts" name="maxOtpAttempts" type="number" defaultValue={data.maxOtpAttempts} />
        </div>
      </div>
    </SettingsForm>
  )
}

function BillingSettings({ data = {} }: { data: any }) {
  return (
    <SettingsForm 
      settingKey="billing"
      title="Billing & Subscriptions"
      description="Configure trial periods and renewal settings."
      defaultData={data}
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="defaultTrialDuration">Default Trial Duration (Days)</Label>
          <Input id="defaultTrialDuration" name="defaultTrialDuration" type="number" defaultValue={data.defaultTrialDuration} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="renewalGracePeriod">Renewal Grace Period (Days)</Label>
          <Input id="renewalGracePeriod" name="renewalGracePeriod" type="number" defaultValue={data.renewalGracePeriod} />
        </div>
      </div>
    </SettingsForm>
  )
}

function SecuritySettings({ data = {} }: { data: any }) {
  return (
    <SettingsForm 
      settingKey="security"
      title="Security Policy"
      description="Manage session timeouts and MFA."
      defaultData={data}
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="adminSessionDuration">Admin Session Duration (Hours)</Label>
          <Input id="adminSessionDuration" name="adminSessionDuration" type="number" defaultValue={data.adminSessionDuration} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessSessionDuration">Business Session Duration (Hours)</Label>
          <Input id="businessSessionDuration" name="businessSessionDuration" type="number" defaultValue={data.businessSessionDuration} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mfaEnforced">Enforce MFA globally</Label>
          <select 
            id="mfaEnforced" 
            name="mfaEnforced" 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={data.mfaEnforced ? 'true' : 'false'}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
    </SettingsForm>
  )
}

function CommunicationSettings({ systemStatus }: { systemStatus: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Communication Providers</CardTitle>
          <CardDescription>Status of external communication integrations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div>
                <p className="font-medium text-slate-900">Email Provider (Brevo)</p>
                <p className="text-sm text-slate-500">Transactional emails and alerts.</p>
              </div>
              <div>
                {systemStatus?.brevoApiKey ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Missing Key</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div>
                <p className="font-medium text-slate-900">SMS Gateway</p>
                <p className="text-sm text-slate-500">OTP and notification SMS.</p>
              </div>
              <div>
                {systemStatus?.smsGatewayUrl && systemStatus?.smsApiKey ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Not Configured</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">SMS Gateway Diagnostics</h3>
        <SmsGatewayTester />
      </div>
    </div>
  )
}

function SystemSettings({ systemStatus }: { systemStatus: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Environment</CardTitle>
        <CardDescription>Read-only view of critical infrastructure configuration.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-xs text-slate-500 uppercase font-semibold">Environment</p>
              <p className="font-medium text-slate-900 mt-1">{systemStatus?.nodeEnv || 'unknown'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-xs text-slate-500 uppercase font-semibold">Database</p>
              <p className="font-medium text-slate-900 mt-1">
                {systemStatus?.databaseUrl ? 'Connected' : 'Missing URL'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-xs text-slate-500 uppercase font-semibold">Payment Provider</p>
              <p className="font-medium text-slate-900 mt-1">
                {systemStatus?.uddoktapayApiKey ? 'UddoktaPay (Active)' : 'Mock Mode'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-xs text-slate-500 uppercase font-semibold">Supabase Keys</p>
              <p className="font-medium text-slate-900 mt-1">
                {systemStatus?.supabaseServiceKey && systemStatus?.supabaseUrl ? 'Valid' : 'Missing'}
              </p>
            </div>
          </div>
          
          <div className="rounded-md bg-blue-50 p-4 mt-4">
            <div className="flex">
              <div className="ml-3 flex-1 md:flex md:justify-between">
                <p className="text-sm text-blue-700">
                  Environment variables contain sensitive secrets and are not exposed to the client. Modify these in Vercel or `.env.local`.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
