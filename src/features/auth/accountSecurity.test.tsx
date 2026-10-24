import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { accountSchema, accountSecurityKey, accountSecurityRequest } from './accountSecurity.api'
import { acceptSession, useAuthStore } from './auth.store'
import { AccountSecuritySection } from './AccountSecuritySection'
import { EmailSecuritySection, validateSignInEmail } from './EmailSecuritySection'
import { PasswordSecuritySection } from './PasswordSecuritySection'
import { SessionSecuritySection } from './SessionSecuritySection'
vi.mock('./auth.store', async original => {
  const module = await original<typeof import('./auth.store')>()
  return { ...module, useAuthStore: Object.assign((selector: (state: ReturnType<typeof module.useAuthStore.getState>) => unknown) => selector(module.useAuthStore.getState()), module.useAuthStore) }
})
const session = { user: { id: 'owner', shopId: 'shop', shopName: 'Shop', name: 'Old name', email: 'stale@example.invalid', role: 'owner' as const }, csrfToken: 'offline-csrf', expiresAt: '2099-01-01T00:00:00.000Z' }
const account = { name: 'Backend Owner', email: 'saved@example.invalid', role: 'owner', status: 'active', updatedAt: '2026-10-23T05:00:00.000Z', emailVerifiedAt: '2026-10-23T04:00:00.000Z', passwordChangedAt: null, emailChangeAvailable: true, pendingEmail: { email: 'pending@example.invalid', expiresAt: '2099-01-01T00:00:00.000Z' }, sessions: [{ current: true, createdAt: '2026-10-23T05:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z', accessMode: 'individual' }] }
const request = vi.fn()
beforeEach(() => { acceptSession(session); useAuthStore.setState({ revision: 7 }); request.mockReset(); vi.stubGlobal('fetch', request) })
afterEach(() => vi.unstubAllGlobals())
function render(data: Omit<typeof account, 'pendingEmail'> & { pendingEmail: typeof account.pendingEmail | null } = account) {
  const client = new QueryClient()
  client.setQueryData(accountSecurityKey(session, 7), data)
  return renderToStaticMarkup(<QueryClientProvider client={client}><AccountSecuritySection /><EmailSecuritySection /><PasswordSecuritySection /><SessionSecuritySection /></QueryClientProvider>)
}
describe('account security cards and transport, offline fixtures', () => {
  it('allows admin self-service but keeps staff and trusted viewers out', () => {
    useAuthStore.setState({ session: { ...session, user: { ...session.user, role: 'admin' } } })
    expect(render()).toContain('Save Changes')
    expect(render()).toContain('Update Password')
    useAuthStore.setState({ session: { ...session, user: { ...session.user, role: 'staff' } } })
    expect(render()).not.toContain('type="password"')
    useAuthStore.setState({ session: { ...session, accessMode: 'trusted-view' } })
    expect(render()).not.toContain('type="password"')
  })
  it('uses backend current email and metadata across four separate cards', () => {
    const html = render()
    for (const value of ['Account Profile', 'Change Sign-in Email', 'Change Password', 'Session Security', 'Backend Owner', 'saved@example.invalid', 'Current Device', 'Last Updated', 'Verified', 'Sign Out Other Devices']) expect(html).toContain(value)
    expect(html).not.toContain('stale@example.invalid')
    expect(html.match(/settings-panel account-security-card/g)).toHaveLength(4)
    expect(html).toContain('aria-label="Show new password"'); expect(html).toContain('aria-label="Show confirm new password"')
  })
  it('offers direct changes without delivery configuration or verification instructions', () => {
    const html = render({ ...account, emailChangeAvailable: false })
    expect(html).toContain('Confirm New Sign-in Email')
    expect(html).toContain('Save Changes')
    expect(html).not.toContain('Send Verification')
    expect(html).not.toContain('Resend Verification')
    expect(html).not.toContain('Email delivery setup is required')
    expect(html).toContain('aria-label="Show current password"')
    expect(html).toContain('readOnly=""')
  })
  it.each([
    ['', '', 'pass', 'Enter a valid new email address.'],
    ['invalid', 'invalid', 'pass', 'Enter a valid new email address.'],
    ['new@example.invalid', '', 'pass', 'Please confirm your new sign-in email.'],
    ['new@example.invalid', 'other@example.invalid', 'pass', 'New email addresses do not match.'],
    [' SAVED@example.invalid ', 'saved@example.invalid', 'pass', 'Choose a different sign-in email.'],
    ['new@example.invalid', 'new@example.invalid', '', 'Please enter your current password.'],
    [' NEW@example.invalid ', 'new@example.invalid', 'pass', ''],
  ])('validates direct email input %s', (email, confirmation, password, message) => {
    expect(validateSignInEmail(email, confirmation, password, account.email)).toBe(message)
  })
  it('separates cached accounts by shop, user and session revision', () => {
    expect(accountSecurityKey(session, 7)).not.toEqual(accountSecurityKey({ ...session, user: { ...session.user, shopId: 'other' } }, 7))
    expect(accountSecurityKey(session, 7)).not.toEqual(accountSecurityKey(session, 8))
  })
  it.each([400, 401, 403, 409, 500, 503])('keeps HTTP %s distinct from a network failure', async status => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Specific account error' }), { status }))
    await expect(accountSecurityRequest('/change-email', { newEmail: 'new@example.invalid', currentPassword: 'offline' })).rejects.toMatchObject({ status, message: 'Specific account error' })
  })
  it('sends a scoped GET with cancellation and never permits secrets into the parsed account cache', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ ...account, passwordHash: 'should-not-be-cached', pendingToken: 'secret' })))
    const signal = new AbortController().signal
    const result = accountSchema.parse(await accountSecurityRequest('/account', undefined, 'GET', signal))
    expect(result).not.toHaveProperty('passwordHash'); expect(result).not.toHaveProperty('pendingToken')
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/auth/account'), expect.objectContaining({ method: 'GET', credentials: 'include', signal: expect.any(AbortSignal) }))
  })
  it.each(['/change-email', '/verify-email'])('handles non-JSON HTTP errors for %s without exposing parser errors', async path => {
    request.mockResolvedValueOnce(new Response('<html>Proxy unavailable</html>', { status: 503 }))
    await expect(accountSecurityRequest(path, { currentPassword: 'offline' })).rejects.toMatchObject({ status: 503, message: 'Account security is temporarily unavailable. Please retry.' })
  })
  it.each(['not JSON', 'null', '[]'])('requires checking account state after an invalid successful write response: %s', async body => {
    request.mockResolvedValueOnce(new Response(body))
    await expect(accountSecurityRequest('/verify-email', { currentPassword: 'offline' })).rejects.toMatchObject({ status: 502, kind: 'invalid-response', outcomeUncertain: true })
  })
  it('preserves server rate-limit timing for security forms', async () => {
    request.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '37' } }))
    await expect(accountSecurityRequest('/verify-email', { currentPassword: 'offline' })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 37 })
  })
})
