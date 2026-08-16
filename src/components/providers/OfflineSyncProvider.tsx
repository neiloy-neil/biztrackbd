'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getOfflineQueue, updateOfflineTransactionStatus, removeSyncedTransactions, OfflineTransaction } from '@/lib/offline/queue'
import { createTransaction } from '@/domains/transactions/actions'
import { toast } from 'sonner'

type SyncContextType = {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  failedCount: number
  syncNow: () => Promise<void>
}

const OfflineSyncContext = createContext<SyncContextType | null>(null)

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [queue, setQueue] = useState<OfflineTransaction[]>([])

  const pendingCount = queue.filter(t => t.status === 'pending').length
  const failedCount = queue.filter(t => t.status === 'failed' || t.status === 'conflict').length

  const refreshQueue = async () => {
    const q = await getOfflineQueue()
    setQueue(q)
  }

  const handleOnline = () => setIsOnline(true)
  const handleOffline = () => setIsOnline(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    refreshQueue()

    // Poll queue every 10 seconds just in case we miss an event or something gets stuck
    const interval = setInterval(refreshQueue, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const processTransaction = async (txn: OfflineTransaction) => {
    await updateOfflineTransactionStatus(txn.id, { status: 'syncing' })
    refreshQueue()

    try {
      if (txn.type === 'transaction') {
        const res = await createTransaction(txn.payload)
        
        if (res.success) {
          await updateOfflineTransactionStatus(txn.id, { status: 'synced' })
        } else {
          // If duplicate error, mark as synced. Otherwise, it's a validation error
          if (res.error?.includes('Duplicate') || res.error?.includes('already being processed')) {
            await updateOfflineTransactionStatus(txn.id, { status: 'synced' })
          } else {
            await updateOfflineTransactionStatus(txn.id, { status: 'failed', errorState: res.error })
          }
        }
      } 
      // Add other types like pos_sale later
      else {
        await updateOfflineTransactionStatus(txn.id, { status: 'failed', errorState: 'Unknown transaction type' })
      }
    } catch (e: any) {
      // Network error during sync (e.g. timeout)
      console.error('Sync error:', e)
      await updateOfflineTransactionStatus(txn.id, { 
        status: 'pending', 
        retryCount: txn.retryCount + 1 
      })
    }
  }

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return

    setIsSyncing(true)
    const currentQueue = await getOfflineQueue()
    const pendingItems = currentQueue.filter(t => t.status === 'pending')

    if (pendingItems.length === 0) {
      setIsSyncing(false)
      return
    }

    for (const txn of pendingItems) {
      // We process sequentially to avoid overwhelming the server and to maintain chronological order
      await processTransaction(txn)
    }

    await removeSyncedTransactions()
    await refreshQueue()
    
    // Check if any were successfully synced and alert the user
    const finalQueue = await getOfflineQueue()
    const stillPending = finalQueue.filter(t => t.status === 'pending')
    if (stillPending.length === 0 && pendingItems.length > 0) {
      toast.success('All transactions synced.', { duration: 3000 })
    }

    setIsSyncing(false)
  }, [isSyncing])

  // Automatically trigger sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow()
    }
  }, [isOnline, pendingCount, syncNow])

  return (
    <OfflineSyncContext.Provider value={{ isOnline, isSyncing, pendingCount, failedCount, syncNow }}>
      {children}
    </OfflineSyncContext.Provider>
  )
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext)
  if (!context) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider')
  }
  return context
}
