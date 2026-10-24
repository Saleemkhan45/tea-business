import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button, PageContainer, Panel, QueryFreshness, SuccessToast } from '../../components/shared'
import { getPakistanBusinessDate } from '../../business/utils/date'
import { CashEntryForm } from './CashEntryForm'
import { CashSkeleton, ManualCashValues } from './CashPanel'
import { CashHistoryPanel } from './CashHistoryPanel'
import { CashSetupStatus } from './CashSetupStatus'
import { CashRecordAction } from './CashRecordAction'
import { CashRecordDetails } from './CashRecordDetails'
import { confirmCashDiscard, useCashDraftGuard } from './useCashDraftGuard'
import { cashErrorMessage, useCashAccess, useCashQuery, type CashStatus, type DayResult } from './api'
import './cashbook.css'

export function CashBookPage() {
  const access = useCashAccess(), [search, setSearch] = useSearchParams(), client = useQueryClient()
  const today = getPakistanBusinessDate(), initial = search.get('date')
  const [date, setDate] = useState(initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) && initial <= today ? initial : today)
  const [notice, setNotice] = useState(''), [entryLocked, setEntryLocked] = useState(false), [dirty, setDirty] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [replacing, setReplacing] = useState<string | null>(null)
  const [viewVoided, setViewVoided] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)
  const status = useCashQuery<CashStatus>('/status')
  const ready = status.data?.ready === true && !status.isError
  const selected = useCashQuery<DayResult>(`/records/by-date/${date}`, ready)
  useCashDraftGuard(dirty, entryLocked)
  if (!access) return <PageContainer><h1>Daily Cash Book</h1><p>Only an authorized shop owner or admin can access manual Cash Book.</p></PageContainer>

  function mayDiscard() {
    if (entryLocked) { setNotice('Resolve the pending save using Retry Same Request before changing this entry.'); return false }
    return !dirty || confirmCashDiscard()
  }
  function openDate(value: string) {
    if (value === date || !mayDiscard()) return
    setDirty(false); setDate(value); setNotice(''); setSearch({ date: value }, { replace: true })
  }
  function refresh() {
    if (!mayDiscard()) return
    setDirty(false); setDraftVersion(value => value + 1)
    void client.invalidateQueries({ queryKey: ['manual-cashbook'] })
  }
  return <PageContainer className="cash-book manual-cash-book">
    <div className="cash-heading cash-page-heading"><div><span className="cash-eyebrow">DAILY REGISTER</span><h1>Daily Cash Book</h1><p>Track shop cash, boss contributions and daily collection history.</p></div>
      <div className="cash-header-actions"><label className="manual-date">Select Date<input aria-label="Business Date" type="date" max={today} value={date} disabled={entryLocked} onChange={event => { if (event.target.value) openDate(event.target.value) }} /></label>
        <Button loading={status.isFetching || selected.isFetching} disabled={entryLocked || status.isFetching} onClick={refresh}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>
        <a className="ui-button ui-button-secondary cash-setup-action" href="#cash-history">History / Export</a>
      </div>
    </div>
    <p className="manual-scope">Independent manual entries. Sales, Khata, Purchases, Inventory and Receive Payment never populate this register.</p>
    {notice && <p className="manual-success" role="status">{notice}</p>}
    {savedMessage && <SuccessToast message={savedMessage} onDismiss={() => setSavedMessage('')} />}
    {status.isError && <p role="alert" className="cash-error">{cashErrorMessage(status.error)} <Button onClick={refresh}>Retry</Button></p>}
    {ready && <QueryFreshness query={selected} label="saved cash record" onRetry={() => void selected.refetch()} />}
    {!status.isError && status.data && !ready && <CashSetupStatus setup={status.data.setup} />}
    {status.isPending || (ready && selected.isPending) ? <CashSkeleton /> : ready && selected.data?.record
      ? <><div className="cash-saved-caption">Saved amounts for {date}</div><ManualCashValues record={selected.data.record} /></>
      : <><ManualCashValues record={null} />{ready && selected.isSuccess && <div className="cash-empty">No cash entry recorded for {date}. Add the day's amounts below.</div>}</>}
    <Panel className="manual-entry-panel"><div className="cash-heading"><div><h2 id="manual-cash-entry">Daily Cash Entry</h2><p>{date} · {selected.data?.record ? 'Saved entry' : 'New entry'}</p></div><span className="cash-entry-badge">{selected.data?.record ? `Revision ${selected.data.record.revision}` : 'Manual entry'}</span></div>
      {ready && selected.isPending ? <p role="status">Loading saved day...</p> : selected.isError && ready && !selected.data ? <p role="alert">{cashErrorMessage(selected.error)} <Button onClick={() => void selected.refetch()}>Retry</Button></p>
        : selected.data?.voidedRecord ? <div className="cash-voided-notice"><p>This date's record was voided. Its amounts and audit history are retained. A replacement uses the same daily record and adds an audited revision.</p><div className="cash-actions"><Button onClick={() => setViewVoided(selected.data!.voidedRecord!._id)}>View Voided Record</Button><Button disabled={!ready} onClick={() => setReplacing(selected.data!.voidedRecord!._id)}>Replace Voided Record</Button></div></div>
          : <CashEntryForm key={`${date}:${selected.data?.record?._id ?? 'new'}:${selected.data?.record?.revision ?? 0}:${draftVersion}`} businessDate={date} record={selected.data?.record ?? null} ready={ready && selected.isSuccess} onSaved={message => { setNotice(message); setSavedMessage(message) }} onLockChange={setEntryLocked} onDirtyChange={setDirty} />}
    </Panel>
    <CashHistoryPanel ready={ready} actionsDisabled={entryLocked || dirty} />
    {replacing && <CashRecordAction recordId={replacing} action="replace" onClose={() => setReplacing(null)} onSaved={message => { setReplacing(null); setNotice(message); setSavedMessage(message) }} />}
    {viewVoided && <CashRecordDetails recordId={viewVoided} onClose={() => setViewVoided(null)} />}
  </PageContainer>
}
