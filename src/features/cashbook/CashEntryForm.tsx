import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/shared'
import { formatPKR } from '../../business/utils/formatters'
import { useAuthStore } from '../auth/auth.store'
import { cashQueryKey, draftAmounts, type CashDay } from './api'
import { confirmCashDiscard } from './useCashDraftGuard'
import { useCashCommand } from './useCashCommand'

export function CashEntryForm({ businessDate, record: savedRecord, ready, onSaved, onLockChange, onDirtyChange, initialEditing = false, onCancel, replacement = false }: { businessDate: string; record: CashDay | null; ready: boolean; onSaved: (message: string) => void; onLockChange?: (locked: boolean) => void; onDirtyChange?: (dirty: boolean) => void; initialEditing?: boolean; onCancel?: () => void; replacement?: boolean }) {
  // Keep the draft paired with the revision it was opened from. Explicit reload
  // remounts this form; background query refreshes must not advance its revision.
  const [record] = useState(savedRecord)
  const reasonRef = useRef<HTMLTextAreaElement>(null), shopRef = useRef<HTMLInputElement>(null)
  const reasonHintId = useId()
  const [shop, setShop] = useState(record ? String(record.shopCashAmount) : ''), [boss, setBoss] = useState(record ? String(record.bossAddedAmount) : '')
  const [notes, setNotes] = useState(record?.notes ?? ''), [reason, setReason] = useState(''), [editing, setEditing] = useState(initialEditing || !record)
  const { submit: sendCommand, busy, uncertain, error, setError, duplicate } = useCashCommand(message => { onDirtyChange?.(false); setEditing(false); onSaved(message) })
  const user = useAuthStore(state => state.session?.user), client = useQueryClient()
  const amounts = draftAmounts(shop, boss), locked = busy || uncertain
  const dirty = editing && (shop !== (record ? String(record.shopCashAmount) : '') || boss !== (record ? String(record.bossAddedAmount) : '') || notes !== (record?.notes ?? '') || reason !== '')
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    onLockChange?.(locked)
    if (!locked && !dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn); onLockChange?.(false) }
  }, [locked, dirty, onLockChange])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !ready || !editing) return
    if (amounts.total === null) { setError('Enter non-negative whole PKR amounts for Shop Cash and Boss Added Money.'); shopRef.current?.focus(); return }
    if (record && (reason.trim().length < 3 || reason.trim().length > 500)) { setError('Enter a reason for this correction (3–500 characters).'); reasonRef.current?.focus(); return }
    const body = { shopCashAmount: Number(shop), bossAddedAmount: Number(boss), notes: notes.trim() }
    await sendCommand({ path: record ? '/records/' + record._id + (replacement ? '/replace' : '') : '/records', method: record && !replacement ? 'PATCH' : 'POST', businessDate, recordId: record?._id,
      body: record ? { ...body, expectedRevision: record.revision, reason: reason.trim() } : { ...body, businessDate } }, replacement ? 'Voided cash record replaced with audit history.' : record ? 'Cash record updated successfully.' : 'Daily cash record saved.')
  }
  return <form className="manual-entry-form" onSubmit={submit} noValidate aria-busy={busy}>
    {record && <p>{replacement ? 'Voided record' : 'Finalized record'} for {businessDate} · revision {record.revision}. Corrections retain the previous values and authenticated operator.</p>}
    {initialEditing && record && <p className="manual-original-total">Original Total: <strong>{formatPKR(record.totalCollected)}</strong></p>}
    <div className="manual-entry-meta"><label>Business Date<input type="date" aria-label="Entry business date" readOnly value={businessDate} /></label><label>Entered By<input readOnly value={record ? record.enteredBy?.name ?? 'Former operator' : user?.name ?? ''} /></label></div>
    <fieldset disabled={locked || !editing} className="manual-fields">
      <label>Shop Cash Amount (PKR)<input ref={shopRef} required type="number" inputMode="numeric" min="0" step="1" max={Number.MAX_SAFE_INTEGER} value={shop} onChange={event => setShop(event.target.value)} /></label>
      <label>Boss Added Money (PKR)<input required type="number" inputMode="numeric" min="0" step="1" max={Number.MAX_SAFE_INTEGER} value={boss} onChange={event => setBoss(event.target.value)} /></label>
      <label className="manual-wide manual-total-preview">Total Cash Collected (calculated)<input readOnly value={amounts.total === null ? '' : formatPKR(amounts.total)} placeholder="Enter Shop Cash and Boss Added" /><small>{editing ? 'Draft preview · saved only after confirmation' : 'Confirmed saved total'}</small></label>
      <label className="manual-wide">Notes (optional)<textarea rows={3} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      {record && editing && <><label>Corrected By<input readOnly value={user?.name ?? ''} /></label><label className="manual-wide">Reason for Correction (required)<textarea ref={reasonRef} required aria-describedby={reasonHintId} minLength={3} maxLength={500} rows={2} value={reason} onChange={event => setReason(event.target.value)} /><small id={reasonHintId}>Explain the correction in 3–500 characters. This is saved in the audit history.</small></label></>}
    </fieldset>
    <p className="manual-form-note">Whole PKR only. Each business date has one saved manual record.</p>
    {editing && (shop !== '' || boss !== '') && amounts.total === null && <p role="status" className="cash-error">Enter a whole PKR amount of zero or more in both fields. Their total must fit the supported amount limit.</p>}
    {error && <p role="alert" className="cash-error">{error}</p>}
    {duplicate && <Button onClick={() => { if (dirty && !confirmCashDiscard()) return; void client.invalidateQueries({ queryKey: cashQueryKey(user?.shopId, `/records/by-date/${businessDate}`, user?.id) }) }}>View Saved Record</Button>}
    <div className="cash-actions">{record && !editing ? <Button disabled={!ready} onClick={() => setEditing(true)}>Correct Record</Button> : <><Button variant="primary" type="submit" loading={busy} disabled={!ready || busy || !editing}>{busy ? 'Saving…' : uncertain ? 'Retry Same Request' : replacement ? 'Save Replacement' : initialEditing ? 'Save Changes' : record ? 'Save Correction' : 'Save Daily Record'}</Button>{record && <Button disabled={locked} onClick={() => { if (onCancel) return onCancel(); if (dirty && !confirmCashDiscard()) return; setShop(String(record.shopCashAmount)); setBoss(String(record.bossAddedAmount)); setNotes(record.notes); setReason(''); setError(''); setEditing(false) }}>{onCancel ? 'Cancel' : 'Cancel Correction'}</Button>}</>}</div>
  </form>
}
