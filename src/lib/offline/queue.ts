import { get, set, update } from 'idb-keyval'

export type OfflineTransactionStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export type OfflineTransaction = {
  id: string
  idempotencyKey: string
  type: 'transaction' | 'pos_sale' | 'party_payment'
  payload: any
  status: OfflineTransactionStatus
  createdAt: string
  retryCount: number
  errorState?: string
}

const QUEUE_KEY = 'biztrack_offline_queue'

export async function getOfflineQueue(): Promise<OfflineTransaction[]> {
  const queue = await get<OfflineTransaction[]>(QUEUE_KEY)
  return queue || []
}

export async function addToOfflineQueue(transaction: Omit<OfflineTransaction, 'status' | 'createdAt' | 'retryCount'>): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) || []
    queue.push({
      ...transaction,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    })
    return queue
  })
}

export async function updateOfflineTransactionStatus(
  id: string, 
  updates: Partial<OfflineTransaction>
): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) || []
    return queue.map(t => t.id === id ? { ...t, ...updates } : t)
  })
}

export async function removeSyncedTransactions(): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) || []
    return queue.filter(t => t.status !== 'synced')
  })
}

export async function removeTransaction(id: string): Promise<void> {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineTransaction[]) || []
    return queue.filter(t => t.id !== id)
  })
}
