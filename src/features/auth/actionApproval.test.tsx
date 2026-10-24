import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { installApprovalHandler } from './actionApproval'
import { acceptSession, clearSession, useAuthStore } from './auth.store'
import { authenticatedFetch, restoreSession } from './auth.api'
import { PasswordSecuritySection } from './PasswordSecuritySection'
import { EmailSecuritySection } from './EmailSecuritySection'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { retryAfterSeconds } from './useRetryAfter'
import { definitiveCashFailure } from '../cashbook/api'
vi.mock('./auth.store', async importOriginal => {
  const original = await importOriginal<typeof import('./auth.store')>()
  return { ...original, useAuthStore: Object.assign((selector: (state: ReturnType<typeof original.useAuthStore.getState>) => unknown) => selector(original.useAuthStore.getState()), original.useAuthStore) }
})
const session = { user: { id: '507f1f77bcf86cd799439011', name: 'Owner', email: 'owner@example.invalid', role: 'owner' as const, shopId: '507f1f77bcf86cd799439012', shopName: 'Shop' }, csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z', authorizationRequired: true }
let remove: (() => void) | undefined
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); acceptSession(session) })
afterEach(() => { remove?.(); vi.unstubAllGlobals(); clearSession() })
it('sends a server action token for exactly the approved payload', async () => {
  const approve = vi.fn().mockResolvedValue('a'.repeat(64)); remove = installApprovalHandler(approve)
  fetchMock.mockResolvedValue(new Response('{}'))
  await authenticatedFetch('http://localhost/api/v1/sales?mode=daily', { method: 'POST', body: JSON.stringify({ idempotencyKey: 'stable', amount: 12 }) })
  expect(approve).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/api/v1/sales?mode=daily', payload: { idempotencyKey: 'stable', amount: 12 } }))
  expect(fetchMock.mock.calls[0][1].headers.get('x-action-authorization')).toBe('a'.repeat(64))
  expect(fetchMock.mock.calls[0][1].headers.get('x-csrf-token')).toBe('csrf')
})
it('does not dispatch a canceled action and does not mislabel it an uncertain write', async () => {
  remove = installApprovalHandler(async () => { throw new Error('Authorization canceled. No changes were sent.') })
  await expect(authenticatedFetch('/api/v1/cashbook/records', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 400, outcomeUncertain: false })
  await authenticatedFetch('/api/v1/cashbook/records', { method: 'POST', body: '{}' }).catch(error => { expect(definitiveCashFailure(error, false)).toBe(true); expect(definitiveCashFailure(error, true)).toBe(false) })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('parses seconds and HTTP-date Retry-After guidance safely', () => {
  expect(retryAfterSeconds('30')).toBe(30)
  expect(retryAfterSeconds(new Date(Date.now() + 60000).toUTCString())).toBeGreaterThanOrEqual(59)
  expect(retryAfterSeconds('invalid')).toBe(900)
})
it('preserves rate limiting and Retry-After without retrying or clearing the session', async () => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }))
  await expect(authenticatedFetch('/api/v1/sales')).rejects.toMatchObject({ status: 429, kind: 'rate-limit', retryAfterSeconds: 30 })
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(useAuthStore.getState().status).toBe('authenticated')
})
it('does not prompt for reads or recurse for authorization endpoints', async () => {
  const approve = vi.fn(); remove = installApprovalHandler(approve); fetchMock.mockImplementation(async () => new Response('{}'))
  await authenticatedFetch('/api/v1/sales'); await authenticatedFetch('/api/v1/auth/authorize', { method: 'POST', body: '{}' })
  expect(approve).not.toHaveBeenCalled()
})
it('rejects a session change while the authorization dialog is open before dispatch', async () => {
  remove = installApprovalHandler(async () => { clearSession(); return 'a'.repeat(64) })
  await expect(authenticatedFetch('/api/v1/sales', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401, outcomeUncertain: false })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('bootstraps trusted viewing only when the server explicitly confirms its boundary', async () => {
  clearSession()
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ trustedViewingAvailable: true }), { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify({ ...session, accessMode: 'trusted-view' })))
  await restoreSession()
  expect(useAuthStore.getState().session?.accessMode).toBe('trusted-view')
  expect(fetchMock.mock.calls[1][0]).toMatch(/auth\/staff-session$/)
})
it('shows the secure password form only to an individually signed-in owner', () => {
  expect(renderToStaticMarkup(<PasswordSecuritySection />)).toContain('Current Password')
  const client = new QueryClient()
  const emailForm = renderToStaticMarkup(<QueryClientProvider client={client}><EmailSecuritySection /></QueryClientProvider>)
  expect(emailForm).toContain('Current Sign-in Email')
  expect(emailForm).toContain('Save Changes')
  expect(emailForm).toContain('aria-label="Show current password"')
  acceptSession({ ...session, accessMode: 'trusted-view' })
  expect(renderToStaticMarkup(<PasswordSecuritySection />)).not.toContain('type="password"')
  expect(renderToStaticMarkup(<QueryClientProvider client={client}><EmailSecuritySection /></QueryClientProvider>)).not.toContain('type="password"')
})
