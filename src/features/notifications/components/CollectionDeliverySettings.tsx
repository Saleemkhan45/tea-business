import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, StateBlock } from '../../../components/shared'
import { deliveryRequest, disablePhonePush, enablePhonePush, pushSupport } from '../push'
import '../../collections/collections.css'

type Capabilities = { mode: string; pushReady: boolean; whatsappReady: boolean; vapidPublicKey: string; canManage: boolean }
type Settings = { push: boolean; whatsapp: boolean; operatorConfigured: boolean; consentAt: string | null; quietStart: string; quietEnd: string; revision: number }
type History = { rows: { _id: string; channel: string; status: string; attempts: number; safeErrorCode?: string; createdAt: string }[] }

export function CollectionDeliverySettings() {
  const capabilities = useQuery({ queryKey: ['notifications', 'collection-capabilities'], queryFn: () => deliveryRequest<Capabilities>('/capabilities') })
  const history = useQuery({ queryKey: ['notifications', 'delivery-history'], queryFn: () => deliveryRequest<History>('/history') })
  const [notice, setNotice] = useState('')
  const action = useMutation({ mutationFn: async (mode: 'enable' | 'disable' | 'test') => {
    if (mode === 'enable') { await enablePhonePush(capabilities.data?.vapidPublicKey ?? ''); return 'This device is subscribed. Delivery also requires shop push settings and an active session. Re-enable after signing in again.' }
    if (mode === 'disable') { await disablePhonePush(); return 'Phone notifications disabled for this device.' }
    const result = await deliveryRequest<{ message: string }>('/test', 'POST')
    return result.message
  }, onSuccess: setNotice })
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  return <section className="collection-card" aria-label="Collection Notifications">
    <h2>Collection Notifications</h2><p>Private operator reminders. No reminder records a payment.</p>
    {capabilities.isPending ? <StateBlock variant="loading" title="Checking delivery setup" message="Loading server capabilities." /> : capabilities.isError ? <StateBlock variant="error" title="Setup unavailable" message={capabilities.error.message} action={<Button onClick={() => void capabilities.refetch()}>Retry</Button>} /> : <>
      <p>Delivery mode: <strong>{capabilities.data.mode === 'live' ? 'Live (requires approved deployment)' : 'Dry run — no external messages'}</strong></p>
      <p>Phone permission: {permission}. WhatsApp: {capabilities.data.whatsappReady ? 'Server configured; recipient approval still required' : 'Provider setup required'}.</p>
      <p>Notifications appear only on supported browsers and devices. On supported iPhone/iPad devices, use Share → Add to Home Screen, open the installed app, then enable notifications. HTTPS is required outside localhost.</p>
      <div className="collection-actions"><Button disabled={action.isPending || !capabilities.data.pushReady || !pushSupport()} onClick={() => action.mutate('enable')}>Enable Phone Notifications</Button><Button disabled={action.isPending} onClick={() => action.mutate('disable')}>Unsubscribe this device</Button><Button disabled={action.isPending} onClick={() => action.mutate('test')}>Test notification (simulation)</Button></div>
      {capabilities.data.canManage && <ShopSettings />}
    </>}
    {notice && <p role="status">{notice}</p>}{action.isError && <p role="alert">{action.error.message}</p>}
    <h3>Delivery History</h3><p>Accepted means the provider accepted a request; it does not prove that the recipient saw it.</p>
    {history.isPending ? <p>Loading history…</p> : history.isError ? <p role="alert">{history.error.message} <Button onClick={() => void history.refetch()}>Retry</Button></p> : !history.data.rows.length ? <p>No delivery attempts recorded.</p> : <ul className="collection-delivery-history">{history.data.rows.map(row => <li key={row._id}><time>{new Date(row.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</time> · {row.channel} · <strong>{row.status}</strong> · Attempts {row.attempts}{row.safeErrorCode && ` · ${row.safeErrorCode}`}</li>)}</ul>}
  </section>
}
function ShopSettings() {
  const query = useQuery({ queryKey: ['notifications', 'collection-delivery-settings'], queryFn: () => deliveryRequest<Settings>('/settings') })
  if (query.isPending) return <p>Loading shop delivery preferences…</p>
  if (query.isError) return <p role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Retry</Button></p>
  return <SettingsEditor key={query.data.revision} initial={query.data} />
}
function SettingsEditor({ initial }: { initial: Settings }) {
  const [draft, setDraft] = useState(initial)
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const client = useQueryClient()
  const save = useMutation({ mutationFn: () => deliveryRequest<Settings>('/settings', 'PUT', {
    push: draft.push, whatsapp: draft.whatsapp, quietStart: draft.quietStart, quietEnd: draft.quietEnd,
    revision: initial.revision, operatorPhone: phone.trim(), operatorConsent: consent,
  }), onSuccess: () => client.invalidateQueries({ queryKey: ['notifications', 'collection-delivery-settings'] }) })
  function submit(event: FormEvent) { event.preventDefault(); save.mutate() }
  return <form className="collection-form collection-delivery-form" onSubmit={submit}>
    <h3>Shop delivery preferences (administrators)</h3>
    <label className="collection-check"><input type="checkbox" checked={draft.push} onChange={e => setDraft({ ...draft, push: e.target.checked })} />Allow subscribed operators’ phones</label>
    <label className="collection-check"><input type="checkbox" checked={draft.whatsapp} onChange={e => setDraft({ ...draft, whatsapp: e.target.checked })} />WhatsApp to approved operator</label>
    <label>Authorized operator WhatsApp number<input type="tel" autoComplete="off" placeholder="+923001234567" maxLength={16} required={draft.whatsapp} value={phone} onChange={e => setPhone(e.target.value)} /><small>Re-enter the deployment-approved number when enabling WhatsApp. Customer phone numbers are never used.</small></label>
    <label className="collection-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I confirm that this approved business operator has opted in to these reminders.</label>
    <label>Quiet hours start (Asia/Karachi)<input type="time" required value={draft.quietStart} onChange={e => setDraft({ ...draft, quietStart: e.target.value })} /></label>
    <label>Quiet hours end<input type="time" required value={draft.quietEnd} onChange={e => setDraft({ ...draft, quietEnd: e.target.value })} /><small>Equal start/end disables quiet hours.</small></label>
    <p>External messages use a privacy-minimized template without customer names or balances. Dashboard reminders use the existing notification controls above.</p>
    <Button type="submit" disabled={save.isPending || (draft.whatsapp && (!consent || !phone.trim()))}>{save.isPending ? 'Saving…' : 'Save collection delivery settings'}</Button>
    {save.isError && <p role="alert">{save.error.message}</p>}
  </form>
}
