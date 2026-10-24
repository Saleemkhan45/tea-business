import { z } from 'zod'
import { acceptSession, refreshSession, clearSession, useAuthStore, type AuthSession } from './auth.store'
import { requestActionApproval } from './actionApproval'
import { retryAfterSeconds } from './useRetryAfter'

const defaultApiUrl = typeof window === 'undefined' ? 'http://localhost:4000/api/v1'
  : import.meta.env.PROD ? `${window.location.origin}/api/v1` : `${window.location.protocol}//${window.location.hostname}:4000/api/v1`
export const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? defaultApiUrl).replace(/\/$/, '')
const sessionSchema = z.object({ user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(['owner', 'admin', 'staff']), shopId: z.string(), shopName: z.string() }), csrfToken: z.string().min(1), expiresAt: z.iso.datetime(), accessMode: z.enum(['individual', 'trusted-view']).optional(), authorizationRequired: z.boolean().optional(), persistent: z.boolean().optional(), absoluteExpiresAt: z.iso.datetime().optional(), serverTime: z.iso.datetime().optional() })
export class AuthApiError extends Error {
  readonly status: number
  readonly kind: 'http' | 'network' | 'timeout' | 'invalid-response' | 'authorization' | 'rate-limit'
  readonly outcomeUncertain: boolean
  readonly trustedViewingAvailable: boolean
  retryAfterSeconds?: number
  constructor(message: string, status: number, kind: AuthApiError['kind'] = status === 0 ? 'network' : 'http', outcomeUncertain = false, trustedViewingAvailable = false) {
    super(message); this.name = 'AuthApiError'; this.status = status; this.kind = kind; this.outcomeUncertain = outcomeUncertain; this.trustedViewingAvailable = trustedViewingAvailable
  }
}
export const AUTH_REQUEST_TIMEOUT_MS = 15000
export const API_REQUEST_TIMEOUT_MS = 15000
const requests = new Set<AbortController>()
function markConnectionUnconfirmed(issue: AuthApiError, revision: number) {
  if (useAuthStore.getState().revision !== revision) return
  useAuthStore.setState({ sessionNeedsValidation: true, connectionStatus: issue.status, connectionRetryable: issue.kind !== 'invalid-response' && (issue.kind === 'network' || issue.kind === 'timeout' || issue.status >= 500 || issue.status === 429), error: issue.message })
}
export function abortAuthenticatedRequests() { requests.forEach(controller => controller.abort()); requests.clear() }
async function revalidateForRequest(signal?: AbortSignal | null) {
  if (signal?.aborted) throw new DOMException('Request canceled.', 'AbortError')
  if (!signal) return restoreSession()
  let cancel!: () => void
  const canceled = new Promise<never>((_resolve, reject) => { cancel = () => reject(new DOMException('Request canceled.', 'AbortError')); signal.addEventListener('abort', cancel, { once: true }) })
  try { return await Promise.race([restoreSession(), canceled]) } finally { signal.removeEventListener('abort', cancel) }
}
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let state = useAuthStore.getState()
  if (state.status !== 'authenticated' || !state.session) throw new AuthApiError('Sign in to continue.', 401)
  const headers = new Headers(init.headers)
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, API_BASE_URL).pathname
  if (init.signal?.aborted) throw new DOMException('Request canceled.', 'AbortError')
  if (state.sessionNeedsValidation && !['/api/v1/auth/session/renew', '/api/v1/auth/logout'].includes(path)) {
    const session = await revalidateForRequest(init.signal)
    const current = useAuthStore.getState()
    if (!session || current.revision !== state.revision) {
      const issue = new AuthApiError(current.error || 'The session must be revalidated before continuing.', current.status === 'anonymous' || current.revision !== state.revision ? 401 : current.connectionStatus)
      if (current.sessionRetryAt > Date.now()) issue.retryAfterSeconds = Math.ceil((current.sessionRetryAt - Date.now()) / 1000)
      throw issue
    }
    state = current
    if (!state.session) throw new AuthApiError('Sign in to continue.', 401)
  }
  if (init.signal?.aborted) throw new DOMException('Request canceled.', 'AbortError')
  if (writing && !path.startsWith('/api/v1/auth/') && state.session.authorizationRequired) {
    let payload: unknown = null
    try { payload = init.body ? JSON.parse(String(init.body)) : null } catch { throw new AuthApiError('This request cannot be authorized safely.', 400) }
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, API_BASE_URL)
    try { headers.set('X-Action-Authorization', await requestActionApproval({ method: (init.method ?? 'POST').toUpperCase(), path: url.pathname + url.search, payload, signal: init.signal ?? undefined })) }
    catch (error) { throw new AuthApiError(error instanceof Error ? error.message : 'Authorization canceled. No changes were sent.', 400, 'authorization') }
    if (useAuthStore.getState().revision !== state.revision) throw new AuthApiError('Session changed before the request was sent.', 401)
  }
  if (writing) headers.set('X-CSRF-Token', state.session.csrfToken)
  const controller = new AbortController()
  const deadline = new AbortController()
  const timeout = setTimeout(() => deadline.abort(new DOMException('Request timed out', 'TimeoutError')), API_REQUEST_TIMEOUT_MS)
  requests.add(controller)
  const signal = AbortSignal.any([controller.signal, deadline.signal, ...(init.signal ? [init.signal] : [])])
  try {
    const response = await fetch(input, { ...init, headers, credentials: 'include', signal })
    const body = response.status === 204 ? null : await response.text()
    if (useAuthStore.getState().revision !== state.revision) throw new AuthApiError('Session changed. Sign in again.', 401, 'http', writing)
    if (response.status === 429) {
      const seconds = retryAfterSeconds(response.headers.get('Retry-After'))
      const issue = new AuthApiError(`Too many requests. Retry after ${seconds} seconds.`, 429, 'rate-limit')
      issue.retryAfterSeconds = seconds
      throw issue
    }
    if (response.status === 401) { clearSession(); abortAuthenticatedRequests(); if (state.session.accessMode === 'trusted-view') void restoreSession() }
    if (response.status >= 500) markConnectionUnconfirmed(new AuthApiError('The server or database is temporarily unavailable. Retry shortly.', response.status), state.revision)
    if (response.ok && !path.startsWith('/api/v1/auth/')) scheduleSessionRenewal()
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (useAuthStore.getState().revision !== state.revision) throw new AuthApiError('Session changed. Sign in again.', 401, 'http', writing)
    if (deadline.signal.aborted || (init.signal?.aborted && init.signal.reason?.name === 'TimeoutError')) {
      const issue = new AuthApiError(`The request timed out. Please retry.${writing ? ' A write may already have reached the server.' : ''}`, 408, 'timeout', writing)
      markConnectionUnconfirmed(issue, state.revision)
      throw issue
    }
    if (signal.aborted) throw new DOMException('Request canceled.', 'AbortError')
    const issue = new AuthApiError('Unable to reach the server. Check your connection and retry.', 0, 'network', writing)
    markConnectionUnconfirmed(issue, state.revision)
    throw issue
  } finally { clearTimeout(timeout); requests.delete(controller) }
}
async function sessionRequest(path: string, body?: object) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'include', signal: controller.signal, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    if (!response.ok) {
    const message = response.status === 401 ? (path === 'login' ? 'Incorrect email or password.' : 'Your session has expired. Sign in again.')
      : response.status === 429 ? (path === 'login' ? 'Too many login attempts. Try again later.' : 'Too many session checks. Try again later.')
        : response.status === 403 ? (path === 'login' ? 'This dashboard origin is not allowed. Contact your administrator.' : 'This session does not have permission to access the dashboard.')
          : response.status === 404 ? 'Authentication endpoint not found. Check the API address and backend version.'
            : response.status === 400 || response.status === 415 ? 'The server rejected the sign-in request. Check your email and try again.'
              : response.status === 503 ? 'The server or database is temporarily unavailable. Retry shortly.'
                : response.status >= 500 ? 'The server could not complete authentication. Try again.'
                  : 'Authentication failed. Try again.'
      const seconds = response.status === 429 ? retryAfterSeconds(response.headers.get('Retry-After')) : undefined
      const guidance = seconds ? ` Wait ${seconds} seconds before retrying.` : ''
      const payload = response.status === 401 ? await response.json().catch(() => null) : null
      const issue = new AuthApiError(message + guidance, response.status, 'http', false, payload?.trustedViewingAvailable === true)
      issue.retryAfterSeconds = seconds
      throw issue
    }
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = null }
    const result = sessionSchema.safeParse(payload)
    if (!result.success) throw new AuthApiError('The server returned an invalid session. Check the API address and backend version.', 502, 'invalid-response')
    if (Date.parse(result.data.expiresAt) <= (result.data.serverTime ? Date.parse(result.data.serverTime) : Date.now())) throw new AuthApiError('Your session has expired. Sign in again.', 401)
    return { ...result.data, validatedAt: Date.now() }
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (controller.signal.aborted) throw new AuthApiError('The server took too long to respond. Try again.', 408, 'timeout')
    throw new AuthApiError('Unable to reach the server. Try again.', 0, 'network')
  } finally {
    clearTimeout(timeout)
  }
}
let restoring: Promise<AuthSession | null> | null = null
let restoringRevision = -1
export function restoreSession() {
  const revision = useAuthStore.getState().revision
  if (restoring && restoringRevision === revision) return restoring
  if (Date.now() < useAuthStore.getState().sessionRetryAt) return Promise.resolve(null)
  const previous = useAuthStore.getState().session
  useAuthStore.setState({ sessionCheckPending: true })
  if (!previous) useAuthStore.setState({ status: 'loading', error: '' })
  const pending: Promise<AuthSession | null> = sessionRequest('session').catch(async error => {
    if (useAuthStore.getState().revision !== revision) throw error
    if (!(error instanceof AuthApiError) || error.status !== 401 || !error.trustedViewingAvailable) throw error
    try { return await sessionRequest('staff-session', {}) }
    catch (staffError) { if (staffError instanceof AuthApiError && [403, 404].includes(staffError.status)) throw error; throw staffError }
  }).then(session => {
    if (useAuthStore.getState().revision !== revision) return null
    refreshSession(session)
    return session
  }).catch(error => {
    if (useAuthStore.getState().revision !== revision) return null
    if (error instanceof AuthApiError && error.status === 401) clearSession()
    else {
      const issue = error instanceof AuthApiError ? error : new AuthApiError('Unable to restore session.', 0)
      markConnectionUnconfirmed(issue, revision)
      useAuthStore.setState({ status: previous ? 'authenticated' : 'error', session: previous, sessionRetryAt: issue.retryAfterSeconds ? Date.now() + issue.retryAfterSeconds * 1000 : 0 })
    }
    return null
  }).finally(() => { if (restoring === pending) restoring = null; if (useAuthStore.getState().revision === revision) useAuthStore.setState({ sessionCheckPending: false }) })
  restoringRevision = revision
  restoring = pending
  return pending
}
export async function login(email: string, password: string, trustedDevice = false) {
  abortAuthenticatedRequests()
  const session = await sessionRequest('login', { email: email.trim(), password, ...(trustedDevice ? { trustedDevice: true } : {}) })
  acceptSession(session)
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem('tea-business-session-change', String(Date.now())) } catch { /* Cross-tab signaling is optional. */ }
  }
  return session
}

let renewal: Promise<void> | null = null
let lastRenewalAttempt = 0
let renewalRevision = -1
export function scheduleSessionRenewal() {
  const state = useAuthStore.getState()
  if (state.status !== 'authenticated' || !state.session?.persistent) return
  if (renewal && renewalRevision === state.revision) return
  if (renewalRevision === state.revision && Date.now() - lastRenewalAttempt < 60000) return
  renewalRevision = state.revision
  lastRenewalAttempt = Date.now()
  const revision = state.revision
  const pending = (async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/auth/session/renew`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!response.ok) throw new AuthApiError('Session renewal is temporarily unavailable. Your unsaved entries are kept on this page.', response.status)
      const result = sessionSchema.safeParse(await response.json())
      if (!result.success) throw new AuthApiError('Session renewal returned invalid data.', 502)
      if (useAuthStore.getState().revision === revision) refreshSession({ ...result.data, validatedAt: Date.now() })
    } catch (error) {
      if (useAuthStore.getState().revision === revision && !(error instanceof DOMException && error.name === 'AbortError')) useAuthStore.setState({ connectionRetryable: error instanceof AuthApiError && (error.kind === 'network' || error.kind === 'timeout' || error.status >= 500), error: error instanceof Error ? error.message : 'Session renewal unavailable.' })
    }
  })().finally(() => { if (renewal === pending) renewal = null })
  renewal = pending
}
export async function logout() {
  const response = await authenticatedFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
  if (!response.ok && response.status !== 401) throw new AuthApiError('Logout could not be confirmed. Try again.', response.status)
  clearSession()
  abortAuthenticatedRequests()
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem('tea-business-logout', String(Date.now())) } catch { /* Server revocation still protects other tabs. */ }
  }
}

export function completeCredentialChange(notice: string) {
  clearSession()
  abortAuthenticatedRequests()
  useAuthStore.setState({ notice })
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem('tea-business-logout', String(Date.now())) } catch { /* Server credential versions still revoke other sessions. */ }
  }
}
