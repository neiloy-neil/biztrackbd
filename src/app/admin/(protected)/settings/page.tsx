import { Settings } from 'lucide-react'
import { SmsGatewayTester } from './sms-tester'

export const metadata = { title: 'Platform Settings | BizTrack Admin' }

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          Platform Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure global application settings and API integrations.</p>
      </div>

      <SmsGatewayTester />
    </div>
  )
}
