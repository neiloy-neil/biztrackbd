import { Settings } from 'lucide-react'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          Platform Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure global application settings and API integrations</p>
      </div>

      <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Coming Soon</h2>
        <p className="text-gray-500">The platform settings module is currently under development.</p>
      </div>
    </div>
  )
}
