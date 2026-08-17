import { get, set, update } from 'idb-keyval'

export const MAX_RETRIES = 5

// Backoff: 30s, 60s, 2m, 4m, 8m — capped at 1 hour
export function backoffMs(retryCount: number): number {
  return Math.min(30_000 * Math.pow(2, retryCount - 1), 3_600_000)
}

export type OfflineTransactionStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export type OfflineTransaction = {
  id: string
  idempotencyKey: string
  type: 'transaction' | 'pos_sale' | 'daily_closing'
  payload: any
  status: OfflineTransactionStatus
  createdAt: string
  retryCount: number
  lastAttemptAt?: string
  errorState?: string
}

const QUEUE_KEY = 'biztrack_offline_queue'

export async function getOfflineQueue(): Promise<OfflineTransaction[]> {
  return (await get<OfflineTransaction[]>(QUEUE_KEY)) ?? []
}

export async function addToOfflineQueue(
  transaction: Omit<OfflineTransaction, 'status' | 'createdAt' | 'retryCount'>
): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    queue.push({
      ...transaction,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    })
    return queue
  })
}

export async function updateOfflineTransactionStatus(
  id: string,
  updates: Partial<OfflineTransaction>
): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.map(t => (t.id === id ? { ...t, ...updates } : t))
  })
}

// On app startup: any item stuck in 'syncing' from a previous crashed session
// goes back to 'pending' so it will be retried.
export async function resetStuckSyncing(): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.map(t =>
      t.status === 'syncing' ? { ...t, status: 'pending' as const } : t
    )
  })
}

export async function removeSyncedTransactions(): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.filter(t => t.status !== 'synced')
  })
}

export async function removeTransaction(id: string): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.filter(t => t.id !== id)
  })
}

export async function clearFailedTransactions(): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.filter(t => t.status !== 'failed' && t.status !== 'conflict')
  })
}

export async function requeueFailedTransactions(): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) ?? []
    return queue.map(t =>
      t.status === 'failed' || t.status === 'conflict'
        ? { ...t, status: 'pending' as const, retryCount: 0, errorState: undefined }
        : t
    )
  })
}

// True if enough time has passed since the last attempt (exponential backoff).
export function isReadyToRetry(txn: OfflineTransaction): boolean {
  if (txn.retryCount === 0 || !txn.lastAttemptAt) return true
  return Date.now() - new Date(txn.lastAttemptAt).getTime() >= backoffMs(txn.retryCount)
}
