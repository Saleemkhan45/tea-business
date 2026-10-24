import { create } from 'zustand'

export type AuthUser = { id: string; name: string; email: string; role: 'owner' | 'admin' | 'staff'; shopId: string; shopName: string }
export type AuthSession = { user: AuthUser; csrfToken: string; expiresAt: string; accessMode?: 'individual' | 'trusted-view'; authorizationRequired?: boolean; persistent?: boolean; absoluteExpiresAt?: string; serverTime?: string; validatedAt?: number }
type AuthState = { status: 'loading' | 'authenticated' | 'anonymous' | 'error'; session: AuthSession | null; error: string; connectionRetryable: boolean; sessionNeedsValidation: boolean; sessionCheckPending: boolean; connectionStatus: number; sessionRetryAt: number; revision: number; notice: string }
const connected = { error: '', connectionRetryable: false, sessionNeedsValidation: false, sessionCheckPending: false, connectionStatus: 200, sessionRetryAt: 0 }
export const useAuthStore = create<AuthState>(() => ({ status: 'loading', session: null, ...connected, revision: 0, notice: '' }))
export function acceptSession(session: AuthSession) {
  useAuthStore.setState(state => ({ status: 'authenticated', session, ...connected, notice: '', revision: state.revision + 1 }))
}
export function refreshSession(session: AuthSession) {
  const previous = useAuthStore.getState().session
  if (!previous || previous.user.id !== session.user.id || previous.user.shopId !== session.user.shopId || previous.user.role !== session.user.role || previous.csrfToken !== session.csrfToken || previous.accessMode !== session.accessMode) return acceptSession(session)
  useAuthStore.setState({ status: 'authenticated', session, ...connected })
}
export function clearSession() {
  useAuthStore.setState(state => ({ status: 'anonymous', session: null, ...connected, notice: '', revision: state.revision + 1 }))
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem('tea-business-notification-token') } catch { /* Cookie authentication does not require localStorage. */ }
  }
}
