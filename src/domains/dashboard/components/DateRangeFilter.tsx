'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentRange = searchParams.get('range') || 'today'

  const handleValueChange = (val: string | null) => {
    if (!val) return
    const params = new URLSearchParams(searchParams)
    params.set('range', val)
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentRange} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm bg-white font-medium border-slate-200">
        <SelectValue placeholder="Select Range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">আজ (Today)</SelectItem>
        <SelectItem value="yesterday">গতকাল (Yesterday)</SelectItem>
        <SelectItem value="this_week">এই সপ্তাহ (This Week)</SelectItem>
        <SelectItem value="this_month">এই মাস (This Month)</SelectItem>
      </SelectContent>
    </Select>
  )
}
