import { QueryClient } from '@tanstack/react-query'

export function retryRead(failureCount: number, error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined
  const kind = error && typeof error === 'object' && 'kind' in error ? error.kind : undefined
  return failureCount < 2 && kind !== 'invalid-response' && !(status && status >= 400 && status < 500 && ![408, 429].includes(status)) && !(error instanceof Error && error.name === 'AbortError')
}

export function readRetryDelay(attempt: number, error: unknown) {
  const retryAfter = error && typeof error === 'object' && 'retryAfterSeconds' in error ? Number(error.retryAfterSeconds) : 0
  const backoff = Math.min(30000, 1000 * 2 ** attempt) * (0.8 + Math.random() * 0.4)
  return Math.max(backoff, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)
}

// Memory only. Session changes cancel requests and clear this client in AuthProvider.
export function createAppQueryClient() {
  const client = new QueryClient({ defaultOptions: {
    queries: { staleTime: 15_000, gcTime: 5 * 60_000, retry: retryRead, retryDelay: readRetryDelay, refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { retry: false },
  } })
  client.setQueryDefaults(['regional', 'dashboard'], { staleTime: 30_000 })
  client.setQueryDefaults(['regional', 'overview'], { staleTime: 30_000 })
  client.setQueryDefaults(['regional', 'regions'], { staleTime: 5 * 60_000 })
  client.setQueryDefaults(['regional', 'products'], { staleTime: 5 * 60_000 })
  client.setQueryDefaults(['sales', 'top-products'], { staleTime: 30_000 })
  client.setQueryDefaults(['customerLedger', 'customer-directory'], { staleTime: 30_000 })
  return client
}
