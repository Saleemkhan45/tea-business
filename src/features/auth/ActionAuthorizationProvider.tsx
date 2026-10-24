import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/shared'
import { installApprovalHandler, type ActionRequest } from './actionApproval'
import { API_BASE_URL, AuthApiError, authenticatedFetch } from './auth.api'
import { useAuthStore } from './auth.store'
import './security.css'
import { SecurityPasswordField } from './PasswordSecuritySection'
import { retryAfterSeconds, useRetryAfter } from './useRetryAfter'

type Pending = { request: ActionRequest; resolve: (token: string) => void; reject: (error: Error) => void }
export function ActionAuthorizationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null), active = useRef<Pending | null>(null)
  const [password, setPassword] = useState(''), [email, setEmail] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const cooldown = useRetryAfter()
  const session = useAuthStore(state => state.session), dialog = useRef<HTMLDivElement>(null)
  function cancel() {
    active.current?.reject(new Error('Authorization canceled. No changes were sent.'))
    active.current = null; setPending(null); setPassword(''); setError('')
  }
  useEffect(() => installApprovalHandler(request => new Promise((resolve, reject) => {
    if (active.current) return reject(new Error('Finish the current authorization first.'))
    if (request.signal?.aborted) return reject(new Error('Authorization canceled. No changes were sent.'))
    const value = { request, resolve, reject }; active.current = value; setPending(value); setEmail(useAuthStore.getState().session?.accessMode === 'trusted-view' ? '' : useAuthStore.getState().session?.user.email ?? ''); setError('')
  })), [])
  useEffect(() => {
    if (!pending) return
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    const abort = () => cancel()
    pending.request.signal?.addEventListener('abort', abort, { once: true })
    const unsubscribe = useAuthStore.subscribe((state, old) => { if (state.revision !== old.revision) cancel() })
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus(); pending.request.signal?.removeEventListener('abort', abort); unsubscribe() }
  }, [pending])
  useEffect(() => () => { active.current?.reject(new Error('Authorization canceled. No changes were sent.')); active.current = null }, [])
  async function confirm() {
    if (!pending || busy || cooldown.remaining) return
    setBusy(true); setError('')
    const current = pending
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/auth/authorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: current.request.method, path: current.request.path, payload: current.request.payload, password, ...(session?.accessMode === 'trusted-view' ? { email } : {}) }) })
      const result = await response.json()
      if (response.status === 429) cooldown.block(retryAfterSeconds(response.headers.get('Retry-After')))
      if (!response.ok) throw new Error(response.status === 429 ? `Too many password attempts. Wait ${response.headers.get('Retry-After') ?? '900'} seconds before retrying.` : result.message ?? 'Authorization failed.')
      if (typeof result.token !== 'string' || !/^[a-f\d]{64}$/.test(result.token)) throw new Error('Invalid authorization response. Retry.')
      if (active.current === current) { current.resolve(result.token); active.current = null; setPending(null) }
    } catch (issue) {
      if (issue instanceof AuthApiError && issue.status === 429) cooldown.block(issue.retryAfterSeconds ?? 900)
      if (active.current === current) setError(issue instanceof Error ? issue.message : 'Authorization failed.')
    }
    finally { setBusy(false); setPassword('') }
  }
  return <>{children}{pending && createPortal(<div className="authorization-overlay" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape' && !busy) cancel()
    if (event.key === 'Tab') {
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')
      const first = nodes?.[0], last = nodes?.[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}><div ref={dialog} className="authorization-dialog" role="dialog" aria-modal="true" aria-labelledby="authorize-title" aria-describedby="authorize-detail"><h2 id="authorize-title">Authorize Changes</h2><p id="authorize-detail">Enter your password to confirm this action.</p><p className="authorization-action">{pending.request.method === 'DELETE' ? 'Delete' : 'Save changes to'} {({ customers: 'customer records', sales: 'sales', regional: 'inventory and regions', purchases: 'purchases', cashbook: 'Cash Book', collections: 'collection schedules', notifications: 'notification preferences', whatsapp: 'messaging settings' } as Record<string, string>)[pending.request.path.split('/')[3]] ?? 'business records'}.</p><form onSubmit={event => { event.preventDefault(); void confirm() }}>
    {session?.accessMode === 'trusted-view' && <label>Operator email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
    <SecurityPasswordField key={pending.request.path} label="Password" required autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
    {error && <p role="alert">{error}</p>}<div className="authorization-actions"><Button disabled={busy} onClick={cancel}>Cancel</Button><Button variant="primary" type="submit" loading={busy} disabled={cooldown.remaining > 0}>{cooldown.remaining ? `Try again in ${cooldown.remaining}s` : 'Confirm'}</Button></div>
  </form></div></div>, document.body)}</>
}
