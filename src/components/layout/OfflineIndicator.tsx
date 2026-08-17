'use client'

import { useOfflineSync } from '@/components/providers/OfflineSyncProvider'
import { CloudOff, RefreshCw, AlertTriangle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow, retryFailed, clearFailed } = useOfflineSync()

  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-xs">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CloudOff className="h-4 w-4 text-slate-300 shrink-0" />
          Offline — saving locally
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-100 text-amber-900 px-4 py-2 rounded-full shadow-lg border border-amber-200 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <RefreshCw className={`h-4 w-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          {pendingCount} pending sync{pendingCount > 1 ? 's' : ''}
          {!isSyncing && (
            <Button variant="ghost" size="sm" onClick={syncNow} className="h-6 px-2 text-amber-900 hover:bg-amber-200 rounded-full ml-1">
              Sync now
            </Button>
          )}
        </div>
      )}

      {failedCount > 0 && (
        <div className="flex items-center gap-2 bg-rose-100 text-rose-900 px-3 py-2 rounded-2xl shadow-lg border border-rose-200 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{failedCount} failed sync{failedCount > 1 ? 's' : ''}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={retryFailed}
            className="h-6 px-2 text-rose-900 hover:bg-rose-200 rounded-full gap-1"
            title="Retry failed syncs"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFailed}
            className="h-6 w-6 p-0 text-rose-700 hover:bg-rose-200 rounded-full"
            title="Discard failed syncs"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
