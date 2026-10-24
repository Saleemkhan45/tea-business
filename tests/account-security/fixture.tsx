// Offline fixtures only. Every fetch is intercepted; no real email or account is changed.
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AccountSecuritySection } from '../../src/features/auth/AccountSecuritySection'
import { EmailSecuritySection } from '../../src/features/auth/EmailSecuritySection'
import { PasswordSecuritySection } from '../../src/features/auth/PasswordSecuritySection'
import { SessionSecuritySection } from '../../src/features/auth/SessionSecuritySection'
import { VerifyEmailPage } from '../../src/features/auth/VerifyEmailPage'
import { LoginPage } from '../../src/features/auth/LoginPage'
import { AuthProvider } from '../../src/features/auth/AuthProvider'
import { useAuthStore } from '../../src/features/auth/auth.store'
import '../../src/style.css'
import '../../src/audit.css'
import '../../src/theme.css'
import '../../src/features/settings/settings.css'

const session = { user: { id: 'offline-owner', shopId: 'offline-shop', name: 'Offline Owner', role: 'owner', email: 'admin@teabusiness.local', shopName: 'Offline Shop' }, csrfToken: 'offline-csrf', expiresAt: '2099-01-01T00:00:00.000Z', accessMode: 'individual' }
const account = { name: 'Offline Owner', email: session.user.email, role: 'owner', status: 'active', updatedAt: '2026-10-23T05:00:00.000Z', passwordChangedAt: '2026-10-01T05:00:00.000Z', emailVerifiedAt: null, pendingEmail: null, emailChangeAvailable: true, sessions: [{ current: true, handle: 'a'.repeat(64), persistent: true, createdAt: '2026-10-23T05:00:00.000Z', expiresAt: session.expiresAt, accessMode: 'individual' }, { current: false, handle: 'c'.repeat(64), persistent: false, createdAt: '2026-10-22T05:00:00.000Z', expiresAt: session.expiresAt, accessMode: 'individual' }] }
window.accountFixture = { calls: [], account, session, delay: 0, sendError: 0, token: 'b'.repeat(64), client: null }
const f = window.accountFixture
useAuthStore.setState({ status: 'authenticated', session, revision: 1 })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input)).pathname, method = init.method || 'GET', body = init.body ? JSON.parse(String(init.body)) : null
  f.calls.push({ path, method, body, csrf: new Headers(init.headers).get('X-CSRF-Token') })
  if (!path.startsWith('/api/v1/auth/')) throw new Error('Unexpected network request blocked by offline fixture')
  if (path.endsWith('/account') && method === 'GET') return json(f.account)
  if (path.endsWith('/change-email')) {
    await new Promise(resolve => setTimeout(resolve, f.delay))
    if (f.sendError) return json({ message: f.sendError === 503 ? 'Service temporarily unavailable. Please retry shortly.' : f.sendError === 403 ? 'Current password is incorrect.' : 'This email cannot be used. Choose another email.' }, f.sendError)
    f.account.email = body.newEmail; f.account.pendingEmail = null; f.account.emailVerifiedAt = null
    return json({ changed: true, signInRequired: true, email: f.account.email })
  }
  if (path.endsWith('/login')) {
    if (body.email !== f.account.email || body.password !== 'offline passphrase') return json({ message: 'Incorrect email or password.' }, 401)
    f.session = { ...session, user: { ...session.user, email: f.account.email } }
    return json(f.session)
  }
  if (path.endsWith('/session')) return json({ ...session, user: { ...session.user, email: f.account.email } })
  if (path.endsWith('/sessions/revoke-others')) { f.account.sessions = f.account.sessions.filter(row => row.current); return json({ revoked: 1 }) }
  throw new Error('Unexpected account fixture request: ' + path)
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); f.client = client
function Settings() { return <main className="settings-page" style={{ margin: 'auto', padding: '20px', maxWidth: '1180px' }}><h1>Settings</h1><div className="settings-layout"><nav className="settings-nav"><a href="#account-security">Account &amp; Security</a><a href="#sign-in-email">Change Email</a><a href="#security">Change Password</a><a href="#session-security">Session Security</a></nav><div className="settings-content"><section className="account-security-grid" aria-label="Account and security"><AccountSecuritySection /><EmailSecuritySection /><PasswordSecuritySection /><SessionSecuritySection /></section></div></div></main> }
function App() {
  const status = useAuthStore(state => state.status)
  f.navigate = useNavigate()
  return <Routes><Route path="/settings" element={status === 'anonymous' ? <Navigate to="/login" /> : <Settings />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/dashboard" element={<div><p>Authenticated fixture dashboard</p><Link to="/settings">Settings</Link></div>} /></Routes>
}
createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter></AuthProvider></QueryClientProvider>)
