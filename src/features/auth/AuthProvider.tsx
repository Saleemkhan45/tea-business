import { useEffect, type ReactNode } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { abortAuthenticatedRequests, restoreSession } from './auth.api'
import { clearSession, useAuthStore, type AuthSession } from './auth.store'
import { startSessionRecovery } from './sessionRecovery'

export function sessionCheckDelay(session: AuthSession, now = Date.now()) {
  const remaining = session.serverTime && session.validatedAt !== undefined
    ? Date.parse(session.expiresAt) - Date.parse(session.serverTime) - (now - session.validatedAt)
    : Date.parse(session.expiresAt) - now
  // A 30-day timeout overflows the browser's signed 32-bit timer. Recheck in chunks.
  return Math.min(24 * 60 * 60 * 1000, Math.max(1000, remaining))
}

export function clearAuthenticatedCache(queryClient: QueryClient) {
  abortAuthenticatedRequests()
  void queryClient.cancelQueries()
  queryClient.clear()
}

// Each failed query gets one extra recovery burst after a confirmed session, until it succeeds.
// This prevents a healthy session endpoint + broken widget endpoint from making an endless loop.
export function refetchFailedReadsAfterRecovery(queryClient: QueryClient, recovered: WeakSet<object>) {
  return queryClient.refetchQueries({ type: 'active', predicate: query => {
    if (query.state.status !== 'error' || query.state.fetchStatus !== 'idle' || recovered.has(query)) return false
    recovered.add(query)
    return true
  } })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  useEffect(() => {
    try { window.localStorage.removeItem('tea-business-notification-token') } catch { /* Legacy token cleanup is optional. */ }
    const recovered = new WeakSet<object>()
    const unsubscribeCache = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.state.status === 'success' && event.query.state.fetchStatus === 'idle') recovered.delete(event.query)
    })
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.revision !== previous.revision) clearAuthenticatedCache(queryClient)
      else if (previous.sessionNeedsValidation && !state.sessionNeedsValidation && state.status === 'authenticated') void refetchFailedReadsAfterRecovery(queryClient, recovered)
    })
    if (useAuthStore.getState().status === 'loading') void restoreSession()
    const sync = (event: StorageEvent) => {
      if (event.key === 'tea-business-logout') clearSession()
      if (event.key === 'tea-business-session-change') { clearSession(); useAuthStore.setState({ status: 'loading' }); void restoreSession() }
    }
    window.addEventListener('storage', sync)
    let lastCheck = 0
    const revalidate = () => {
      const state = useAuthStore.getState()
      if ((!state.session && state.status !== 'error') || Date.now() - lastCheck < 15000) return
      lastCheck = Date.now()
      void restoreSession()
    }
    const visible = () => { if (document.visibilityState === 'visible') revalidate() }
    window.addEventListener('online', revalidate)
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', visible)
    return () => { unsubscribe(); unsubscribeCache(); window.removeEventListener('storage', sync); window.removeEventListener('online', revalidate); window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', visible) }
  }, [queryClient])
  const session = useAuthStore(state => state.session)
  const retryable = useAuthStore(state => state.connectionRetryable)
  useEffect(() => {
    if (!retryable) return
    return startSessionRecovery({ check: restoreSession, state: useAuthStore.getState, canCheck: () => document.visibilityState === 'visible' && navigator.onLine })
  }, [retryable])
  useEffect(() => {
    if (!session) return
    let timeout: number
    const check = () => {
      const current = useAuthStore.getState().session
      if (!current) return
      const delay = sessionCheckDelay(current)
      if (delay <= 1000) void restoreSession()
      else timeout = window.setTimeout(check, delay)
    }
    timeout = window.setTimeout(check, sessionCheckDelay(session))
    return () => window.clearTimeout(timeout)
  }, [session])
  return children
}
