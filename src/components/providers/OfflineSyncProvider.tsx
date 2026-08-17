'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  getOfflineQueue,
  updateOfflineTransactionStatus,
  removeSyncedTransactions,
  resetStuckSyncing,
  clearFailedTransactions,
  requeueFailedTransactions,
  isReadyToRetry,
  MAX_RETRIES,
  OfflineTransaction,
} from '@/lib/offline/queue'
import { createTransaction } from '@/domains/transactions/actions'
import { toast } from 'sonner'

type SyncContextType = {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  failedCount: number
  syncNow: () => Promise<void>
  retryFailed: () => Promise<void>
  clearFailed: () => Promise<void>
}

const OfflineSyncContext = createContext<SyncContextType | null>(null)

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline]   = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [queue, setQueue]         = useState<OfflineTransaction[]>([])

  const pendingCount = queue.filter(t => t.status === 'pending' || t.status === 'syncing').length
  const failedCount  = queue.filter(t => t.status === 'failed' || t.status === 'conflict').length

  const refreshQueue = useCallback(async () => {
    setQueue(await getOfflineQueue())
  }, [])

  // Recover any items that got stuck as 'syncing' (browser closed during a sync)
  useEffect(() => {
    resetStuckSyncing().then(refreshQueue)
  }, [refreshQueue])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline  = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Sync when the tab becomes visible again (catches the case where the user
    // was offline in a background tab and came back online before returning to it)
    const handleVisibility = () => {
      if (!document.hidden && navigator.onLine) setIsOnline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)

    refreshQueue()
    const interval = setInterval(refreshQueue, 10_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [refreshQueue])

  const processTransaction = async (txn: OfflineTransaction) => {
    const now = new Date().toISOString()
    await updateOfflineTransactionStatus(txn.id, {
      status: 'syncing',
      lastAttemptAt: now,
    })
    refreshQueue()

    try {
      let res: { success: boolean; error?: string }

      if (txn.type === 'transaction') {
        res = await createTransaction(txn.payload)
      } else if (txn.type === 'pos_sale') {
        const { processPOSSale } = await import('@/domains/pos/actions')
        res = await processPOSSale(txn.payload)
      } else if (txn.type === 'daily_closing') {
        const { closeDay } = await import('@/domains/closing/actions')
        res = await closeDay(txn.payload)
      } else {
        res = { success: false, error: 'Unknown transaction type' }
      }

      if (res.success) {
        await updateOfflineTransactionStatus(txn.id, { status: 'synced' })
      } else if (
        res.error?.includes('Duplicate') ||
        res.error?.includes('already being processed')
      ) {
        // Idempotency hit — the server already processed this; treat as synced
        await updateOfflineTransactionStatus(txn.id, { status: 'synced' })
      } else {
        const nextRetry = txn.retryCount + 1
        await updateOfflineTransactionStatus(txn.id, {
          status:     nextRetry >= MAX_RETRIES ? 'failed' : 'pending',
          retryCount: nextRetry,
          errorState: res.error,
        })
        if (nextRetry >= MAX_RETRIES) {
          toast.error(`A sale could not be synced after ${MAX_RETRIES} attempts. Tap "Failed syncs" to review.`)
        }
      }
    } catch (e: any) {
      // Network error during sync — keep pending, increment retry counter
      const nextRetry = txn.retryCount + 1
      await updateOfflineTransactionStatus(txn.id, {
        status:     nextRetry >= MAX_RETRIES ? 'failed' : 'pending',
        retryCount: nextRetry,
        errorState: e?.message,
      })
    }
  }

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return

    setIsSyncing(true)
    const currentQueue = await getOfflineQueue()

    // Only attempt items that are pending AND have waited long enough (backoff)
    const readyItems = currentQueue.filter(
      t => t.status === 'pending' && isReadyToRetry(t)
    )

    for (const txn of readyItems) {
      await processTransaction(txn)
    }

    await removeSyncedTransactions()
    await refreshQueue()

    const afterQueue    = await getOfflineQueue()
    const stillPending  = afterQueue.filter(t => t.status === 'pending').length
    const justSynced    = readyItems.length - stillPending

    if (justSynced > 0) {
      toast.success(
        justSynced === 1 ? '1 offline sale synced.' : `${justSynced} offline sales synced.`,
        { duration: 3000 }
      )
    }

    setIsSyncing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, refreshQueue])

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow()
    }
  }, [isOnline]) // intentionally omit syncNow/pendingCount to fire once on transition

  const retryFailed = useCallback(async () => {
    await requeueFailedTransactions()
    await refreshQueue()
    syncNow()
  }, [refreshQueue, syncNow])

  const clearFailed = useCallback(async () => {
    await clearFailedTransactions()
    await refreshQueue()
  }, [refreshQueue])

  return (
    <OfflineSyncContext.Provider
      value={{ isOnline, isSyncing, pendingCount, failedCount, syncNow, retryFailed, clearFailed }}
    >
      {children}
    </OfflineSyncContext.Provider>
  )
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext)
  if (!context) throw new Error('useOfflineSync must be used within an OfflineSyncProvider')
  return context
}
