import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Monitor } from 'lucide-react'
import { z } from 'zod'
import { Button, LoadingSpinner, Panel } from '../../components/shared'
import { AuthApiError, logout } from './auth.api'
import { useAuthStore } from './auth.store'
import { SecurityPasswordField } from './PasswordSecuritySection'
import { accountSecurityRequest, securityDate, useAccountSecurity } from './accountSecurity.api'
import { useRetryAfter } from './useRetryAfter'

export function SessionSecuritySection() {
  const session = useAuthStore(state => state.session)
  const canManageAccount = ['owner', 'admin'].includes(session?.user.role ?? '') && session?.accessMode !== 'trusted-view'
  const account = useAccountSecurity(), client = useQueryClient(), cooldown = useRetryAfter()
  const [password, setPassword] = useState(''), [target, setTarget] = useState('all'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const saving = useRef(false)
  async function revoke(event: FormEvent) {
    event.preventDefault()
    if (saving.current || cooldown.remaining || !canManageAccount) return
    saving.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await accountSecurityRequest(`/sessions/${target === 'all' ? 'revoke-others' : 'revoke'}`, { currentPassword: password, ...(target === 'all' ? {} : { handle: target }) })
      if (target === 'all') z.object({ revoked: z.number().int().nonnegative() }).parse(result)
      else z.object({ revoked: z.literal(true) }).parse(result)
      setNotice('Selected other sessions signed out. This session remains active.'); setTarget('all')
      void client.invalidateQueries({ queryKey: ['account-security'] })
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      setError(issue instanceof Error ? issue.message : 'Session revocation was not confirmed.')
    } finally { saving.current = false; setBusy(false); setPassword('') }
  }
  return <Panel className="settings-panel account-security-card" id="session-security"><div className="security-card-heading"><span><Monitor size={20} aria-hidden="true" /></span><div><h2>Session Security</h2><p>Review access and sign out other devices.</p></div></div>
    {!canManageAccount ? <p>Sign in individually as an owner or admin to manage sessions.</p> : <>
      {account.isFetching && <LoadingSpinner label="Loading active sessions" showLabel />}
      {account.isError && <div className="security-feedback error" role="alert"><p>{account.error.message}</p><Button onClick={() => void account.refetch()}>Retry sessions</Button></div>}
      {account.data && <><div className="security-session-summary"><span>Active Sessions <strong>{account.data.sessions.length}</strong></span><span>Last Password Change <strong>{securityDate(account.data.passwordChangedAt)}</strong></span></div>
        <ul className="account-session-list">{account.data.sessions.map((row, index) => <li key={row.handle ?? index}><strong>{row.current ? 'Current Device · This session' : 'Other device session'}</strong><span>{row.persistent ? 'Trusted device · renewable session' : row.accessMode === 'trusted-view' ? 'Shop viewing' : 'Standard sign-in'}</span><small>Started {securityDate(row.createdAt)} · Expires {securityDate(row.expiresAt)}</small></li>)}</ul>
        <form className="security-password-form" onSubmit={revoke} aria-busy={busy}><label>Sessions to sign out<select value={target} onChange={event => setTarget(event.target.value)} disabled={busy}><option value="all">All other sessions</option>{account.data.sessions.filter(row => !row.current && row.handle).map(row => <option key={row.handle} value={row.handle}>Session started {securityDate(row.createdAt)}</option>)}</select></label><SecurityPasswordField label="Current Password" required autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          <Button type="submit" variant="primary" loading={busy} disabled={cooldown.remaining > 0}>{cooldown.remaining ? `Try again in ${cooldown.remaining}s` : target === 'all' ? 'Sign Out Other Devices' : 'Sign Out Selected Device'}</Button>
        </form><Button disabled={busy} onClick={async () => { if (saving.current) return; saving.current = true; setBusy(true); try { await logout() } catch (issue) { setError(issue instanceof Error ? issue.message : 'Sign out was not confirmed.') } finally { saving.current = false; setBusy(false) } }}>Sign Out This Device</Button>
      </>}
      {error && <p className="security-feedback error" role="alert">{error}</p>}{notice && <p className="security-feedback success" role="status">{notice}</p>}
    </>}
  </Panel>
}
