import { useEffect, useState, type FormEvent } from 'react'
import { Button, LoadingSpinner } from '../../components/shared'
import { formatPKR } from '../../business/utils/formatters'
import { cashErrorMessage, useCashQuery, type CashDay, type CashDetails } from './api'
import { CashDialog } from './CashDialog'
import { CashEntryForm } from './CashEntryForm'
import { confirmCashDiscard, useCashDraftGuard } from './useCashDraftGuard'
import { useCashCommand } from './useCashCommand'

export type CashAction = 'edit' | 'void' | 'replace'
export function CashRecordAction({ recordId, action, onClose, onSaved }: { recordId: string; action: CashAction; onClose: () => void; onSaved: (message: string) => void }) {
  const query = useCashQuery<CashDetails>(`/records/${recordId}?page=1`)
  const [locked, setLocked] = useState(false), [dirty, setDirty] = useState(false), [notice, setNotice] = useState('')
  const [formVersion, setFormVersion] = useState(0)
  useCashDraftGuard(dirty, locked)
  function close() {
    if (locked) { setNotice('Resolve the pending operation with Retry Same Request before closing.'); return }
    if (dirty && !confirmCashDiscard()) return
    onClose()
  }
  const record = query.data?.record, voided = record?.status === 'voided'
  const eligible = record && (action === 'replace' ? voided : !voided)
  return <CashDialog title={action === 'void' ? 'Delete Daily Cash Record?' : action === 'replace' ? 'Replace Voided Cash Record' : 'Edit Daily Cash Record'} onClose={close} locked={locked}>
    {notice && <p role="status">{notice}</p>}
    {query.isError && query.data && <p role="alert">Could not reload the saved record. Your draft is preserved. {cashErrorMessage(query.error)}</p>}
    {query.data && <Button disabled={locked || query.isFetching} onClick={() => { if (dirty && !confirmCashDiscard()) return; void query.refetch().then(result => { if (result.isSuccess) setFormVersion(value => value + 1) }) }}>Reload Saved Record</Button>}
    {query.isPending ? <LoadingSpinner showLabel label="Loading saved cash record…" /> : query.isError && !query.data ? <p role="alert">{cashErrorMessage(query.error)} <Button onClick={() => void query.refetch()}>Retry</Button></p>
      : !eligible ? <p role="alert">{voided ? 'This record is already voided. Open its business date to create an audited replacement.' : 'This record is active and cannot be replaced.'}</p>
        : action === 'void' ? <VoidCashForm key={formVersion} record={record} onCancel={close} onSaved={onSaved} onLockChange={setLocked} onDirtyChange={setDirty} />
          : <CashEntryForm key={formVersion} businessDate={record.businessDate} record={record} ready initialEditing replacement={action === 'replace'} onCancel={close} onSaved={onSaved} onLockChange={setLocked} onDirtyChange={setDirty} />}
  </CashDialog>
}

function VoidCashForm({ record, onCancel, onSaved, onLockChange, onDirtyChange }: { record: CashDay; onCancel: () => void; onSaved: (message: string) => void; onLockChange: (value: boolean) => void; onDirtyChange: (value: boolean) => void }) {
  const [reason, setReason] = useState('')
  const { submit, busy, uncertain, error } = useCashCommand(onSaved), locked = busy || uncertain
  useEffect(() => { onLockChange(locked); return () => onLockChange(false) }, [locked, onLockChange])
  useEffect(() => { onDirtyChange(Boolean(reason)); return () => onDirtyChange(false) }, [reason, onDirtyChange])
  useEffect(() => {
    if (!locked && !reason) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [locked, reason])
  function confirm(event: FormEvent) {
    event.preventDefault()
    if (busy || reason.trim().length < 3) return
    void submit({ path: `/records/${record._id}/void`, method: 'POST', body: { expectedRevision: record.revision, reason: reason.trim() }, businessDate: record.businessDate, recordId: record._id, status: 'voided' }, 'Daily cash record deleted from active history. Its values and audit history are preserved.')
  }
  const date = new Date(`${record.businessDate}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' })
  return <form className="manual-void-form" onSubmit={confirm} aria-busy={busy}>
    <p>Are you sure you want to delete the cash record for <strong>{date}</strong>? This action will remove it from active Cash Book History.</p>
    <dl className="manual-values">{[['Date', record.businessDate], ['Shop Cash', formatPKR(record.shopCashAmount)], ['Boss Added', formatPKR(record.bossAddedAmount)], ['Total', formatPKR(record.totalCollected)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>The record will be voided. Original amounts and all revisions remain available for audit. Replacing this date requires a separate audited action.</p>
    <label>Deletion Reason<textarea required minLength={3} maxLength={500} rows={3} disabled={locked} value={reason} onChange={event => setReason(event.target.value)} /></label>
    {error && <p role="alert" className="cash-error">{error}</p>}
    <div className="cash-actions"><Button disabled={locked} onClick={onCancel}>Cancel</Button><Button className="cash-danger" type="submit" loading={busy} disabled={busy || reason.trim().length < 3}>{uncertain ? 'Retry Same Request' : 'Confirm Delete'}</Button></div>
  </form>
}
