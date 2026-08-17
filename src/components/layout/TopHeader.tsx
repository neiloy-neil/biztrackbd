'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, TrendingUp } from 'lucide-react'
import { NotificationBell } from '@/domains/notifications/components/NotificationBell'

export function TopHeader() {
  const pathname = usePathname() || ''
  
  if (
    !pathname.startsWith('/app') || 
    pathname === '/app/login' || 
    pathname === '/app/pos' || 
    pathname === '/app/onboarding'
  ) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between px-4 bg-white/80 backdrop-blur-md border-b">
      <div className="font-bold text-lg text-emerald-700 tracking-tight">BizTrack BD</div>
      <div className="flex items-center gap-2">
        <Link href="/app/insights" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
          <TrendingUp className="w-5 h-5" />
        </Link>
        <Link href="/app/assistant" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
          <Sparkles className="w-5 h-5" />
        </Link>
        <NotificationBell />
      </div>
    </div>
  )
}
