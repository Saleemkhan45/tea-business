import { useRef, useState, type FormEvent, type InputHTMLAttributes, type Ref } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Button, Panel } from '../../components/shared'
import { API_BASE_URL, AuthApiError, authenticatedFetch, completeCredentialChange } from './auth.api'
import { useAuthStore } from './auth.store'
import './security.css'
import { retryAfterSeconds, useRetryAfter } from './useRetryAfter'

export function SecurityPasswordField({ label, ref, ...inputProps }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; ref?: Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false)
  return <label>{label}<span className="security-password-control">
    <input {...inputProps} ref={ref} type={visible ? 'text' : 'password'} />
    <button type="button" className="security-password-toggle" disabled={inputProps.disabled} title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </span></label>
}

export function PasswordSecuritySection() {
  const session = useAuthStore(state => state.session)
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submitting = useRef(false)
  const cooldown = useRetryAfter()
  const canManageAccount = ['owner', 'admin'].includes(session?.user.role ?? '') && session?.accessMode !== 'trusted-view'
  async function save(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !canManageAccount || cooldown.remaining) return
    setError('')
    if (password.length < 12 || password.length > 256) return setError('Use a unique passphrase of 12 to 256 characters.')
    if (password !== confirm) return setError('New passwords must match.')
    if (password === current) return setError('Choose a different new password.')
    submitting.current = true; setBusy(true)
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: current, newPassword: password, confirmPassword: confirm }) })
      const result = await response.json()
      if (response.status === 429) cooldown.block(retryAfterSeconds(response.headers.get('Retry-After')))
      if (!response.ok || result.changed !== true) throw new Error(response.status === 429 ? `Too many attempts. Wait ${response.headers.get('Retry-After') ?? '900'} seconds before retrying.` : result.message ?? 'Password change was not confirmed.')
      setCurrent(''); setPassword(''); setConfirm('')
      completeCredentialChange('Your password has been updated successfully. Please sign in again.')
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setError(issue instanceof Error ? issue.message : 'Password change could not be confirmed.'); setCurrent(''); setPassword(''); setConfirm('')
    }
    finally { submitting.current = false; setBusy(false) }
  }
  return <Panel className="settings-panel account-security-card" id="security"><div className="security-card-heading"><span><LockKeyhole size={20} aria-hidden="true" /></span><div><h2>Change Password</h2><p>Keep your account protected.</p></div></div><p>Your individual sign-in password also authorizes changes. Changing it revokes existing sessions and approvals.</p>{!canManageAccount ? <p>Sign in individually as an owner or admin to change this password.</p> : <form className="security-password-form" onSubmit={save} aria-busy={busy}><SecurityPasswordField label="Current Password" autoComplete="current-password" required maxLength={256} value={current} onChange={event => setCurrent(event.target.value)} disabled={busy} /><SecurityPasswordField label="New Password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><SecurityPasswordField label="Confirm New Password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy} /><p>Use a unique passphrase with at least 12 characters.</p>{error && <p role="alert">{error}</p>}<Button type="submit" variant="primary" loading={busy} disabled={cooldown.remaining > 0}>Update Password</Button></form>}</Panel>
}
