import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { acceptSession, refreshSession, clearSession, useAuthStore } from './auth.store'
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS, AUTH_REQUEST_TIMEOUT_MS, authenticatedFetch, login, logout, restoreSession, completeCredentialChange, scheduleSessionRenewal } from './auth.api'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from './LoginPage'
import { QueryClient } from '@tanstack/react-query'
import { clearAuthenticatedCache, sessionCheckDelay } from './AuthProvider'
vi.mock('./auth.store', async importOriginal => {
  const original = await importOriginal<typeof import('./auth.store')>()
  return { ...original, useAuthStore: Object.assign((selector?: (state: ReturnType<typeof original.useAuthStore.getState>) => unknown) => selector ? selector(original.useAuthStore.getState()) : original.useAuthStore.getState(), original.useAuthStore) }
})

const session = { user: { id: '507f1f77bcf86cd799439011', name: 'Real Operator', email: 'owner@example.invalid', role: 'owner' as const, shopId: '507f1f77bcf86cd799439012', shopName: 'Approved Shop' }, csrfToken: 'offline-csrf-token', expiresAt: '2099-01-01T00:00:00.000Z' }
const fetchMock = vi.fn()
beforeEach(() => {
  useAuthStore.setState({ status: 'loading', session: null, error: '', sessionNeedsValidation: false, sessionCheckPending: false, sessionRetryAt: 0, connectionStatus: 200, connectionRetryable: false, revision: 0 })
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('authentication client and route protection', () => {
  it('sends the trusted-device opt-in only when selected', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, persistent: true })))
    await login(' owner@example.invalid ', 'offline password', true)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ trustedDevice: true, email: 'owner@example.invalid' })
  })
  it.each([0, 500, 503])('preserves the mounted authenticated session during a temporary %i restoration failure', async status => {
    acceptSession(session)
    const revision = useAuthStore.getState().revision
    if (status) fetchMock.mockResolvedValueOnce(new Response('{}', { status }))
    else fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', session, revision })
    const markup = renderToStaticMarkup(<MemoryRouter initialEntries={['/private']}><Routes><Route element={<ProtectedRoute />}><Route path="/private" element={<p>Unsaved entry remains mounted</p>} /></Route></Routes></MemoryRouter>)
    expect(markup).toContain('Unsaved entry remains mounted')
    expect(markup).toContain('Retry connection')
  })
  it('refreshes session expiry without incrementing identity revision or clearing caches', async () => {
    acceptSession(session)
    const revision = useAuthStore.getState().revision
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, expiresAt: '2099-02-01T00:00:00.000Z' })))
    await restoreSession()
    expect(useAuthStore.getState().revision).toBe(revision)
    expect(useAuthStore.getState().session?.expiresAt).toBe('2099-02-01T00:00:00.000Z')
    refreshSession({ ...session, user: { ...session.user, shopId: 'another-shop' } })
    expect(useAuthStore.getState().revision).toBeGreaterThan(revision)
  })
  it('avoids 32-bit timer overflow and bases expiry on server time when client clocks differ', () => {
    const now = Date.now()
    expect(sessionCheckDelay({ ...session, expiresAt: new Date(now + 30 * 86400000).toISOString() }, now)).toBe(86400000)
    expect(sessionCheckDelay({ ...session, serverTime: '2026-10-01T00:00:00.000Z', expiresAt: '2026-10-01T01:00:00.000Z', validatedAt: now }, now)).toBe(3600000)
  })
  it('uses authoritative server time rather than falsely expiring a session on a fast client clock', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, serverTime: '2000-01-01T00:00:00.000Z', expiresAt: '2000-01-02T00:00:00.000Z' })))
    await restoreSession()
    expect(useAuthStore.getState().status).toBe('authenticated')
  })
  it('renews only after successful activity, deduplicates attempts and preserves the session on renewal failure', async () => {
    acceptSession({ ...session, persistent: true })
    const revision = useAuthStore.getState().revision
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await authenticatedFetch('/api/v1/sales')
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, persistent: true })))
    fetchMock.mockResolvedValueOnce(new Response('{}'))
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await authenticatedFetch('/api/v1/sales')
    await vi.waitFor(() => expect(useAuthStore.getState().error).toContain('renewal'))
    scheduleSessionRenewal(); scheduleSessionRenewal()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', revision })
  })
  it('signals credential changes to other tabs without persisting credentials', () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { setItem, removeItem: vi.fn() } })
    acceptSession(session)
    completeCredentialChange('Please sign in again.')
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', notice: 'Please sign in again.' })
    expect(setItem).toHaveBeenCalledWith('tea-business-logout', expect.any(String))
    expect(setItem.mock.calls.flat().join(' ')).not.toContain(session.csrfToken)
  })
  it('bounds authenticated saves without retrying an uncertain write', async () => {
    vi.useFakeTimers(); acceptSession(session)
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = authenticatedFetch('/api/v1/cashbook/records', { method: 'POST', body: '{}' })
    const assertion = expect(pending).rejects.toMatchObject({ status: 408, kind: 'timeout', outcomeUncertain: true })
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS)
    await assertion
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().status).toBe('authenticated')
  })
  it('bounds response-body loading and distinguishes canceled reads from network failures', async () => {
    vi.useFakeTimers(); acceptSession(session)
    fetchMock.mockImplementationOnce(async (_url, init) => {
      const response = new Response('{}')
      response.text = () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
      return response
    })
    const pending = authenticatedFetch('/api/v1/sales/dashboard')
    const assertion = expect(pending).rejects.toMatchObject({ status: 408, kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS)
    await assertion
    acceptSession(session)
    const controller = new AbortController()
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
    const canceled = authenticatedFetch('/api/v1/sales/dashboard', { signal: controller.signal })
    const canceledAssertion = expect(canceled).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await canceledAssertion
  })
  it('clears sensitive query and mutation caches when authentication changes', () => {
    const client = new QueryClient()
    client.setQueryData(['customers', 'private'], { name: 'Private customer' })
    clearAuthenticatedCache(client)
    expect(client.getQueryData(['customers', 'private'])).toBeUndefined()
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
  it('logs in using a cookie request and restores the authenticated operator without persisting a JWT', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
    await login(' owner@example.invalid ', 'offline-password')
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/auth/login`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include', method: 'POST' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'owner@example.invalid', password: 'offline-password' })
    expect(useAuthStore.getState().session?.user.name).toBe('Real Operator')
    expect(useAuthStore.getState().session).not.toHaveProperty('token')
  })

  it('does not require browser localStorage to complete login or logout', async () => {
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw new Error('Storage disabled') }, removeItem: () => { throw new Error('Storage disabled') } } })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
    await login('owner@example.invalid', 'offline-password')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await logout()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('uses one restoration request for concurrent startup callers', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
    await Promise.all([restoreSession(), restoreSession()])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().status).toBe('authenticated')
  })
  it('starts a fresh restore after a cross-tab session change instead of remaining stuck loading', async () => {
    let finishOld!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const oldRestore = restoreSession()
    clearSession()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session)))
    await restoreSession()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().status).toBe('authenticated')
    finishOld(new Response('{}', { status: 401 }))
    await oldRestore
    expect(useAuthStore.getState().status).toBe('authenticated')
  })
  it('rejects an already-expired session payload without exposing protected content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, expiresAt: '2000-01-01T00:00:00.000Z' })))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null })
  })

  it('keeps invalid credentials separate from temporary server failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(login('owner@example.invalid', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Incorrect email or password.' })
    fetchMock.mockRejectedValueOnce(new TypeError('private-network-details'))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'error', session: null, error: 'Unable to reach the server. Try again.' })
  })

  it('clears an expired restored session', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/auth/session`)
  })

  it.each([
    [400, 'The server rejected'], [403, 'origin is not allowed'],
    [404, 'endpoint not found'], [429, 'Too many login attempts'],
    [500, 'server could not complete'], [503, 'database is temporarily unavailable'],
  ])('preserves HTTP %i without labeling it a connection failure', async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status }))
    await expect(login('owner@example.invalid', 'offline-password')).rejects.toMatchObject({ status, kind: 'http', message: expect.stringContaining(message) })
    expect(useAuthStore.getState().session).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('times out an unresponsive server and permits an explicit retry', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = login('owner@example.invalid', 'offline-password')
    const assertion = expect(pending).rejects.toMatchObject({ status: 408, kind: 'timeout', message: 'The server took too long to respond. Try again.' })
    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS)
    await assertion
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
    await login('owner@example.invalid', 'offline-password')
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('keeps the timeout active until the session body has arrived', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(async (_url, init) => ({ ok: true,
      text: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    }))
    const pending = login('owner@example.invalid', 'offline-password')
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('rejects an HTML fallback or incompatible session response as a protocol problem', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Frontend fallback</html>', { status: 200 }))
    await expect(login('owner@example.invalid', 'offline-password')).rejects.toMatchObject({ status: 502, kind: 'invalid-response' })
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('shows restoration errors and an explicit Retry action on Sign In', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await restoreSession()
    const markup = renderToStaticMarkup(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(markup).toContain('Unable to reach the server.')
    expect(markup).toContain('Retry connection')
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', error: '' })
    expect(renderToStaticMarkup(<MemoryRouter><LoginPage /></MemoryRouter>)).not.toContain('Unable to reach')
  })

  it('attaches credentials and CSRF to writes, never an editable operator or bearer token', async () => {
    acceptSession(session)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await authenticatedFetch('http://localhost:4000/api/v1/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const init = fetchMock.mock.calls[0][1]
    expect(init.credentials).toBe('include')
    expect(init.headers.get('X-CSRF-Token')).toBe(session.csrfToken)
    expect(init.headers.has('Authorization')).toBe(false)
  })

  it('blocks anonymous API access before sending a request and clears the client on 401', async () => {
    clearSession()
    await expect(authenticatedFetch('/api/v1/customers')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
    acceptSession(session)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await authenticatedFetch('/api/v1/customers')
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('clears the client only after server logout succeeds, and does not falsely claim failed revocation', async () => {
    acceptSession(session)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(logout()).rejects.toMatchObject({ status: 503 })
    expect(useAuthStore.getState().status).toBe('authenticated')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await logout()
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null })
  })

  it('rejects late authenticated responses after a session change', async () => {
    acceptSession(session)
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = authenticatedFetch('/api/v1/customers')
    clearSession()
    resolve(new Response('{"private":"old-shop-data"}', { status: 200 }))
    await expect(pending).rejects.toMatchObject({ status: 401 })
  })

  it('marks an in-flight write uncertain when the session changes after dispatch', async () => {
    acceptSession(session)
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = authenticatedFetch('/api/v1/cashbook/records', { method: 'POST', body: '{}' })
    clearSession(); resolve(new Response('{}'))
    await expect(pending).rejects.toMatchObject({ status: 401, outcomeUncertain: true })
    await expect(authenticatedFetch('/api/v1/cashbook/records', { method: 'POST' })).rejects.toMatchObject({ status: 401, outcomeUncertain: false })
  })

  it('does not restore a stale startup response after logout', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = restoreSession()
    clearSession()
    resolve(new Response(JSON.stringify(session), { status: 200 }))
    await pending
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('renders accessible login fields and keeps protected content hidden without a session', () => {
    clearSession()
    const loginMarkup = renderToStaticMarkup(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(loginMarkup).toContain('Tea Business')
    expect(loginMarkup).toContain('autoComplete="username"')
    expect(loginMarkup).toContain('autoComplete="current-password"')
    const protectedMarkup = renderToStaticMarkup(<MemoryRouter initialEntries={['/private']}><Routes><Route element={<ProtectedRoute />}><Route path="/private" element={<p>Private customer data</p>} /></Route></Routes></MemoryRouter>)
    expect(protectedMarkup).not.toContain('Private customer data')
    acceptSession(session)
    expect(renderToStaticMarkup(<MemoryRouter initialEntries={['/private']}><Routes><Route element={<ProtectedRoute />}><Route path="/private" element={<p>Private customer data</p>} /></Route></Routes></MemoryRouter>)).toContain('Private customer data')
  })
})

describe('connection failures keep drafts mounted and block unvalidated operations', () => {
  it('revalidates once before concurrent protected operations after a network outage', async () => {
    acceptSession(session)
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(authenticatedFetch('/api/v1/sales/dashboard')).rejects.toMatchObject({ status: 0 })
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', sessionNeedsValidation: true })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session)))
    fetchMock.mockImplementation(async () => new Response('{}'))
    await Promise.all([authenticatedFetch('/api/v1/sales'), authenticatedFetch('/api/v1/cashbook/records', { method: 'POST', body: '{"idempotencyKey":"same-key"}' })])
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/session'))).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    expect(fetchMock.mock.calls.at(-1)?.[1].body).toContain('same-key')
    expect(useAuthStore.getState().sessionNeedsValidation).toBe(false)
  })
  it('does not dispatch a write when recovery fails or returns a genuine 401', async () => {
    acceptSession(session)
    useAuthStore.setState({ sessionNeedsValidation: true })
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(authenticatedFetch('/api/v1/sales', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().status).toBe('authenticated')
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(authenticatedFetch('/api/v1/sales', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    expect(useAuthStore.getState().session).toBeNull()
  })
  it('respects a session 429 deadline without clearing cookies or looping', async () => {
    vi.useFakeTimers(); acceptSession(session)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '37' } }))
    await restoreSession(); await restoreSession(); await restoreSession()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', connectionStatus: 429, sessionNeedsValidation: true })
    await vi.advanceTimersByTimeAsync(37000)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session)))
    await restoreSession()
    expect(useAuthStore.getState().sessionNeedsValidation).toBe(false)
  })
  it('leaves authorization and protocol failures distinct without automatic retries', async () => {
    acceptSession(session)
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', connectionRetryable: false, connectionStatus: 403 })
    fetchMock.mockResolvedValueOnce(new Response('<html>wrong server</html>'))
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ connectionRetryable: false, connectionStatus: 502 })
  })
  it('cancels a read waiting for a shared session check without logging out', async () => {
    acceptSession(session); useAuthStore.setState({ sessionNeedsValidation: true })
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const controller = new AbortController()
    const pending = authenticatedFetch('/api/v1/sales', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await assertion
    resolve(new Response(JSON.stringify(session))); await restoreSession()
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
