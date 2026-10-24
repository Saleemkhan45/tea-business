import { useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { Badge, Button, LoadingSpinner, Panel } from '../../components/shared'
import { AuthApiError, restoreSession } from './auth.api'
import { useAuthStore } from './auth.store'
import { SecurityPasswordField } from './PasswordSecuritySection'
import { useRetryAfter } from './useRetryAfter'
import { accountSecurityRequest, securityDate, useAccountSecurity } from './accountSecurity.api'

export function AccountSecuritySection() {
  const session = useAuthStore(state => state.session)
  const canManageAccount = ['owner', 'admin'].includes(session?.user.role ?? '') && session?.accessMode !== 'trusted-view'
  const account = useAccountSecurity(), client = useQueryClient()
  const [name, setName] = useState<string | null>(null), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('')
  const saving = useRef(false), cooldown = useRetryAfter()
  async function saveName(event: FormEvent) {
    event.preventDefault()
    if (saving.current || cooldown.remaining || !canManageAccount || !account.data) return
    const nextName = (name ?? account.data.name).trim()
    if (!nextName) { setError('Enter your display name.'); return }
    saving.current = true; setBusy(true); setError(''); setNotice('')
    try {
      z.object({ changed: z.boolean() }).parse(await accountSecurityRequest('/account', { name: nextName, currentPassword: password }, 'PATCH'))
      setNotice('Account name saved.')
      void client.invalidateQueries({ queryKey: ['account-security'] })
      await restoreSession()
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setError(issue instanceof Error ? issue.message : 'Profile update was not confirmed.')
    } finally { saving.current = false; setBusy(false); setPassword('') }
  }
  return <Panel className="settings-panel account-security-card account-security-panel" id="account-security">
    <div className="security-card-heading"><span><UserRound size={20} aria-hidden="true" /></span><div><h2>Account Profile</h2><p>Your authenticated sign-in identity.</p></div></div>
    {!canManageAccount ? <p>Sign in individually as an owner or admin to manage account security.</p> : <>
      {account.isFetching && <LoadingSpinner label="Loading account profile" showLabel />}
      {account.isError && <div className="security-feedback error" role="alert"><p>{account.error.message}</p><Button onClick={() => void account.refetch()}>Retry account details</Button></div>}
      {account.data && <><dl className="account-details"><div><dt>Display Name</dt><dd>{account.data.name}</dd></div><div><dt>Account Role</dt><dd><Badge tone="neutral">{account.data.role}</Badge></dd></div><div className="security-detail-wide"><dt>Current Login Email</dt><dd>{account.data.email}</dd></div><div><dt>Email Verification</dt><dd><Badge tone={account.data.emailVerifiedAt ? 'success' : 'warning'}>{account.data.emailVerifiedAt ? 'Verified' : 'Not verified'}</Badge></dd></div><div><dt>Last Updated</dt><dd>{securityDate(account.data.updatedAt)}</dd></div></dl>
        <details className="account-profile-editor"><summary>Edit display name</summary><form className="security-password-form" onSubmit={saveName} aria-busy={busy}><label>Display Name<input autoComplete="name" required maxLength={100} value={name ?? account.data.name} onChange={event => setName(event.target.value)} disabled={busy} /></label><SecurityPasswordField label="Current Password" required autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><Button type="submit" variant="primary" loading={busy} disabled={cooldown.remaining > 0}>{cooldown.remaining ? `Try again in ${cooldown.remaining}s` : 'Save Display Name'}</Button></form></details>
      </>}
      {error && <p className="security-feedback error" role="alert">{error}</p>}{notice && <p className="security-feedback success" role="status">{notice}</p>}
    </>}
  </Panel>
}
