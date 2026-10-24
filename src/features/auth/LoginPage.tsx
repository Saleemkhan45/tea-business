import { useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Leaf, LogIn, ShieldCheck } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Button } from '../../components/shared'
import { AuthApiError, login, restoreSession } from './auth.api'
import { useAuthStore } from './auth.store'
import './auth.css'
import { useRetryAfter } from './useRetryAfter'

export function LoginPage() {
  const status = useAuthStore(state => state.status)
  const sessionError = useAuthStore(state => state.error)
  const notice = useAuthStore(state => state.notice)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [trustedDevice, setTrustedDevice] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [retryable, setRetryable] = useState(false)
  const saving = useRef(false)
  const cooldown = useRetryAfter()
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || cooldown.remaining) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) return setError('Enter your email address and password.')
    saving.current = true
    setPending(true)
    setError('')
    setRetryable(false)
    try { await login(email, password, trustedDevice) }
    catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to sign in.')
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setRetryable(issue instanceof AuthApiError && (issue.kind === 'network' || issue.kind === 'timeout' || issue.status >= 500))
    }
    finally { saving.current = false; setPending(false) }
  }
  return <main className="auth-page">
    <header className="auth-brand"><span className="auth-brand-mark"><Leaf size={25} aria-hidden="true" /></span><div><strong>Tea Business</strong><small>Business Dashboard</small></div></header>
    <section className="auth-login" aria-labelledby="login-title">
      <span className="auth-label">YOUR BUSINESS, CONNECTED</span><h1 id="login-title">Welcome back</h1><p className="auth-intro">Sign in to manage your tea business.</p>
      {notice && <div className="auth-credential-notice" role="status"><p>{notice}</p><button type="button" aria-label="Dismiss account update notification" onClick={() => useAuthStore.setState({ notice: '' })}>Dismiss</button></div>}
      {status === 'error' && !error && <div role="alert"><p className="auth-error">{sessionError}</p><Button type="button" disabled={pending} onClick={() => void restoreSession()}>Retry connection</Button></div>}
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <label>Email address<input type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required maxLength={254} value={email} disabled={pending} onBlur={() => setEmail(value => value.trim())} onChange={event => setEmail(event.target.value)} /></label>
        <label>Password<span className="auth-password"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} disabled={pending} onChange={event => setPassword(event.target.value)} /><button type="button" title={showPassword ? 'Hide password' : 'Show password'} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(current => !current)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        <label className="auth-trusted-device"><input type="checkbox" checked={trustedDevice} disabled={pending} onChange={event => setTrustedDevice(event.target.checked)} /><span>Keep this trusted device signed in<small>Choose this only on a private shop computer you control.</small></span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" loading={pending || status === 'loading'} disabled={pending || status === 'loading' || cooldown.remaining > 0}><LogIn size={17} />{cooldown.remaining ? `Try again in ${cooldown.remaining}s` : pending ? 'Signing in...' : status === 'loading' ? 'Checking session...' : retryable ? 'Retry sign in' : 'Sign in'}</Button>
      </form>
      <p className="auth-session-note"><ShieldCheck size={15} aria-hidden="true" /> Trusted-device sessions renew during authorized activity within the server’s maximum lifetime. Sign out on shared computers.</p>
      <details className="auth-recovery"><summary>Need help signing in?</summary><p>Contact your shop owner or deployment administrator for account recovery. Passwords cannot be viewed or retrieved.</p></details>
    </section>
    <footer className="auth-footer">Tea Wholesale Management · Private business workspace</footer>
  </main>
}
