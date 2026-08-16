'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState, useEffect } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            networkMode: 'offlineFirst',
          },
        },
      })
  )

  const [persister, setPersister] = useState<any>(null)

  useEffect(() => {
    // Only run on the client side
    if (typeof window !== 'undefined') {
      const storagePersister = createSyncStoragePersister({
        storage: window.localStorage,
      })
      setPersister(storagePersister)
    }
  }, [])

  if (!persister) {
    // Render without persistence while loading persister (or on server)
    return children
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
