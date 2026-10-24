import { useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Mail } from 'lucide-react'
import { Button, LoadingSpinner, Panel } from '../../components/shared'
import { AuthApiError, completeCredentialChange } from './auth.api'
import { useAuthStore } from './auth.store'
import { SecurityPasswordField } from './PasswordSecuritySection'
import { useRetryAfter } from './useRetryAfter'
import { accountSecurityRequest, useAccountSecurity } from './accountSecurity.api'

export function validateSignInEmail(email: string, confirmation: string, password: string, currentEmail: string) {
  const normalized = email.trim().toLowerCase()
  if (!z.string().email().max(254).safeParse(normalized).success) return 'Enter a valid new email address.'
  if (!confirmation.trim()) return 'Please confirm your new sign-in email.'
  if (normalized !== confirmation.trim().toLowerCase()) return 'New email addresses do not match.'
  if (normalized === currentEmail.trim().toLowerCase()) return 'Choose a different sign-in email.'
  if (!password) return 'Please enter your current password.'
  return ''
}

export function EmailSecuritySection() {
  const session = useAuthStore(state => state.session)
  const account = useAccountSecurity()
  const [email, setEmail] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const cooldown = useRetryAfter()
  const canManageAccount = ['owner', 'admin'].includes(session?.user.role ?? '') && session?.accessMode !== 'trusted-view'

  async function save(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !canManageAccount || cooldown.remaining || !account.data) return
    const validation = validateSignInEmail(email, confirmation, password, account.data.email)
    setError(validation)
    if (validation) return
    const normalized = email.trim().toLowerCase()
    if (!window.confirm(`Change your sign-in email to ${normalized}? Double-check spelling. You will need to sign in again.`)) return
    submitting.current = true
    setBusy(true)
    try {
      const result = z.object({ changed: z.literal(true), signInRequired: z.literal(true), email: z.string().email() }).safeParse(
        await accountSecurityRequest('/change-email', { newEmail: normalized, confirmNewEmail: confirmation.trim().toLowerCase(), currentPassword: password }),
      )
      if (!result.success || result.data.email !== normalized) throw new Error('Email update was not confirmed. Check account status before retrying.')
      completeCredentialChange('Sign-in email updated successfully. Please sign in with your new email.')
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setError(issue instanceof Error ? issue.message : 'Email change could not be confirmed.')
    } finally {
      setPassword('')
      submitting.current = false
      setBusy(false)
    }
  }

  return <Panel className="settings-panel account-security-card" id="sign-in-email">
    <div className="security-card-heading"><span><Mail size={20} aria-hidden="true" /></span><div><h2>Change Sign-in Email</h2><p>Update the email you use to access your Tea Business account.</p></div></div>
    <p>Double-check the spelling of your new email. Saving signs out all existing sessions. No verification email is sent.</p>
    {!canManageAccount ? <p>Sign in individually as an owner or admin to change this email.</p> : <form noValidate className="security-password-form" onSubmit={save} aria-busy={busy}>
      {account.isFetching && <LoadingSpinner label="Checking account email status" showLabel />}
      {account.isError && <div className="security-feedback error" role="alert"><p>{account.error.message}</p><Button onClick={() => void account.refetch()}>Retry account status</Button></div>}
      <label>Current Sign-in Email<input type="email" value={account.data?.email ?? ''} readOnly /></label>
      <label>New Sign-in Email<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
      <label>Confirm New Sign-in Email<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>
      <SecurityPasswordField label="Current Password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      {error && <p className="security-feedback error" role="alert">{error}</p>}
      {cooldown.remaining > 0 && <p role="status">Try again in {cooldown.remaining} seconds.</p>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy || cooldown.remaining > 0 || account.isPending || account.isError}>Save Changes</Button>
    </form>}
  </Panel>
}
