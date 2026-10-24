import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/shared'
import { AuthApiError, restoreSession, completeCredentialChange } from './auth.api'
import { accountSecurityRequest } from './accountSecurity.api'
import { useAuthStore } from './auth.store'
import { SecurityPasswordField } from './PasswordSecuritySection'
import { useRetryAfter } from './useRetryAfter'
import './auth.css'

export function VerifyEmailPage() {
  const [token, setToken] = useState(() => window.location.hash.slice(1))
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const saving = useRef(false)
  const status = useAuthStore(state => state.status)
  const cooldown = useRetryAfter()
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (saving.current || cooldown.remaining) return
    saving.current = true; setBusy(true); setError('')
    try {
      const confirmed = z.object({ changed: z.literal(true), signInRequired: z.literal(true), email: z.string().email() }).safeParse(
        await accountSecurityRequest('/verify-email', { token, currentPassword: password }),
      )
      if (!confirmed.success) throw new Error('Email verification was not confirmed. Check your account before retrying.')
      setConfirmedEmail(confirmed.data.email)
      setDone(true); setToken(''); completeCredentialChange(`Sign-in email updated to ${confirmed.data.email}. Sign in with that email and your existing password.`)
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setError(issue instanceof Error ? issue.message : 'Email verification was not confirmed.')
    } finally { saving.current = false; setBusy(false); setPassword('') }
  }
  return <main className="auth-page"><section className="auth-login"><span className="auth-label">Tea Business · Account Security</span><h1>Verify new email</h1>
    {done ? <><p role="status">Your sign-in email is now <strong>{confirmedEmail}</strong>. Sign in with this email and your existing password.</p><Link to="/login">Go to sign in</Link></> : !/^[a-f\d]{64}$/.test(token) ? <><p role="alert">This verification link is missing or invalid. Open the full link from your email, or request a new one in Settings.</p><Link to="/settings#account-security">Account Settings</Link></> : status !== 'authenticated' ? <><p>Sign in with your current email in another tab, then check your session here to continue.</p><Link to="/login" target="_blank" rel="noopener noreferrer">Open sign in</Link><Button loading={status === 'loading'} onClick={() => void restoreSession()}>Check session</Button></> : <form onSubmit={confirm} aria-busy={busy}><p>Confirm this email change with your current password. This will sign out existing sessions.</p><SecurityPasswordField label="Current Password" required autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />{error && <p role="alert" className="auth-error">{error}</p>}<Button type="submit" variant="primary" loading={busy} disabled={cooldown.remaining > 0}>{cooldown.remaining ? `Try again in ${cooldown.remaining}s` : 'Verify and Update Email'}</Button></form>}
  </section></main>
}
