'use client'

import { useOfflineSync } from '@/components/providers/OfflineSyncProvider'
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow } = useOfflineSync()

  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CloudOff className="h-4 w-4 text-slate-300" />
          Offline Mode — Saving locally
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-100 text-amber-900 px-4 py-2 rounded-full shadow-lg border border-amber-200 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {pendingCount} transaction{pendingCount > 1 ? 's' : ''} waiting to sync
          {!isSyncing && (
            <Button variant="ghost" size="sm" onClick={syncNow} className="h-6 px-2 text-amber-900 hover:bg-amber-200 rounded-full ml-2">
              Sync Now
            </Button>
          )}
        </div>
      )}

      {failedCount > 0 && (
        <div className="flex items-center gap-2 bg-rose-100 text-rose-900 px-4 py-2 rounded-full shadow-lg border border-rose-200 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <AlertTriangle className="h-4 w-4" />
          {failedCount} failed sync{failedCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
