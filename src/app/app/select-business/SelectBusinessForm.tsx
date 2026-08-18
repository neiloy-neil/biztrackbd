'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { setActiveBusinessAction } from './actions'
import { Loader2, Building2 } from 'lucide-react'

interface Business {
  id: string
  name: string
  status: string
}

export function SelectBusinessForm({ businesses }: { businesses: Business[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSelect = async (business: Business) => {
    setLoading(business.id)
    setError('')

    const res = await setActiveBusinessAction(business.id)
    if (res.success) {
      if (res.status !== 'active') {
        window.location.href = '/app/suspended'
      } else {
        // We will just redirect to dashboard. If there is a pending checkout intent,
        // it can be picked up from there, or we can check here.
        // The safest fallback is redirecting to /app/dashboard and letting it route.
        // Actually, if they just logged in during checkout flow, the intent cookie is there.
        // The dashboard or checkout route can intercept. Let's redirect to /app/dashboard
        window.location.href = '/app/dashboard'
      }
    } else {
      setError(res.error || 'Failed to select business')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {businesses.map((business) => (
        <Button
          key={business.id}
          variant="outline"
          className="w-full h-16 flex items-center justify-start px-4 space-x-4 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
          onClick={() => handleSelect(business)}
          disabled={loading !== null}
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            {loading === business.id ? (
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            ) : (
              <Building2 className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-slate-900">{business.name}</div>
            <div className="text-sm text-slate-500 capitalize">{business.status} Workspace</div>
          </div>
        </Button>
      ))}

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
          {error}
        </div>
      )}
    </div>
  )
}
