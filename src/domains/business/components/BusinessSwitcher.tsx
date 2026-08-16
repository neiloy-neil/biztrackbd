'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveBusiness } from '../actions'

type Business = { id: string; name: string }

export function BusinessSwitcher({ businesses, activeId }: { businesses: Business[], activeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSwitch = async (id: string) => {
    if (id === activeId) return
    setLoading(true)
    await setActiveBusiness(id)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
      <span className="text-xs font-semibold text-slate-500 uppercase">Business</span>
      <select 
        disabled={loading}
        value={activeId}
        onChange={(e) => handleSwitch(e.target.value)}
        className="bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 outline-none cursor-pointer"
      >
        {businesses.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
