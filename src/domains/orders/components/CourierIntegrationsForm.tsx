'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveIntegrationSettings } from '@/domains/orders/courier-actions'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

export function CourierIntegrationsForm({ initialData }: { initialData: any[] }) {
  const router = useRouter()
  
  const steadfastData = initialData.find(i => i.provider === 'steadfast')
  const pathaoData = initialData.find(i => i.provider === 'pathao')

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  
  const [steadfastKey, setSteadfastKey] = useState(steadfastData?.api_key || '')
  const [steadfastSecret, setSteadfastSecret] = useState(steadfastData?.api_secret || '')

  const [pathaoClient, setPathaoClient] = useState(pathaoData?.api_key || '')
  const [pathaoSecret, setPathaoSecret] = useState(pathaoData?.api_secret || '')
  const [pathaoStoreId, setPathaoStoreId] = useState(pathaoData?.store_id || '')

  const handleSave = async (provider: 'steadfast' | 'pathao') => {
    setLoadingProvider(provider)
    try {
      const payload = provider === 'steadfast' 
        ? { provider, apiKey: steadfastKey, apiSecret: steadfastSecret }
        : { provider, apiKey: pathaoClient, apiSecret: pathaoSecret, storeId: pathaoStoreId }

      const res = await saveIntegrationSettings(payload)
      if (res.success) {
        toast.success(`${provider} integration saved`)
        router.refresh()
      } else {
        toast.error(res.error || `Failed to save ${provider}`)
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Steadfast Section */}
      <div className="border rounded-lg p-4 space-y-4 relative">
        {steadfastData?.is_active && (
          <div className="absolute top-4 right-4 flex items-center text-green-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Connected
          </div>
        )}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center font-bold">
            SF
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Steadfast Courier</h4>
            <p className="text-xs text-slate-500">Fast and reliable nationwide delivery.</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="sf-key">API Key</Label>
            <Input id="sf-key" value={steadfastKey} onChange={(e) => setSteadfastKey(e.target.value)} placeholder="Enter Steadfast API Key" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sf-secret">Secret Key</Label>
            <Input id="sf-secret" type="password" value={steadfastSecret} onChange={(e) => setSteadfastSecret(e.target.value)} placeholder="Enter Steadfast Secret Key" />
          </div>
          <Button 
            disabled={loadingProvider === 'steadfast' || !steadfastKey || !steadfastSecret} 
            onClick={() => handleSave('steadfast')}
            size="sm"
          >
            {loadingProvider === 'steadfast' ? 'Saving...' : 'Save Steadfast'}
          </Button>
        </div>
      </div>

      {/* Pathao Section */}
      <div className="border rounded-lg p-4 space-y-4 relative">
        {pathaoData?.is_active && (
          <div className="absolute top-4 right-4 flex items-center text-green-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Connected
          </div>
        )}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold">
            PT
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Pathao Courier</h4>
            <p className="text-xs text-slate-500">Popular courier for fast delivery inside Dhaka.</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="pt-client">Client ID</Label>
            <Input id="pt-client" value={pathaoClient} onChange={(e) => setPathaoClient(e.target.value)} placeholder="Enter Pathao Client ID" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-secret">Client Secret</Label>
            <Input id="pt-secret" type="password" value={pathaoSecret} onChange={(e) => setPathaoSecret(e.target.value)} placeholder="Enter Pathao Client Secret" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-store">Store ID</Label>
            <Input id="pt-store" value={pathaoStoreId} onChange={(e) => setPathaoStoreId(e.target.value)} placeholder="Enter Pathao Store ID" />
          </div>
          <Button 
            disabled={loadingProvider === 'pathao' || !pathaoClient || !pathaoSecret} 
            onClick={() => handleSave('pathao')}
            size="sm"
          >
            {loadingProvider === 'pathao' ? 'Saving...' : 'Save Pathao'}
          </Button>
        </div>
      </div>
    </div>
  )
}
