import { useEffect, useState } from 'react'
import { Eye, SquarePen, Trash2 } from 'lucide-react'
import { Button, ExportMenu, Panel, QueryFreshness, SuccessToast } from '../../components/shared'
import { formatPKR } from '../../business/utils/formatters'
import { getPakistanBusinessDate } from '../../business/utils/date'
import { cashErrorMessage, downloadCashCsv, useCashQuery, type CashHistory } from './api'
import { CashRecordDetails } from './CashRecordDetails'
import { CashRecordAction, type CashAction } from './CashRecordAction'

function shift(date: string, days: number) { const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10) }
export function CashHistoryPanel({ ready, actionsDisabled = false }: { ready: boolean; actionsDisabled?: boolean }) {
  const today = getPakistanBusinessDate()
  const [period, setPeriod] = useState('month'), [from, setFrom] = useState(today), [to, setTo] = useState(today), [page, setPage] = useState(1), [details, setDetails] = useState<string | null>(null)
  const [action, setAction] = useState<{ id: string; mode: CashAction } | null>(null), [message, setMessage] = useState('')
  const week = shift(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const bounds: Record<string, [string, string]> = { today: [today, today], yesterday: [shift(today, -1), shift(today, -1)], week: [week, today], month: [`${today.slice(0, 7)}-01`, today], custom: [from, to] }
  const [start, end] = bounds[period], valid = Boolean(start && end && start <= end && end <= today)
  const params = new URLSearchParams({ from: start, to: end, page: String(page), limit: '20' })
  const query = useCashQuery<CashHistory>(`/records?${params}`, ready && valid), data = query.data
  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / data.limit))) setPage(Math.max(1, Math.ceil(data.total / data.limit)))
  }, [data, page])
  function exportPage() {
    if (!data) return
    downloadCashCsv([['Manual daily records only; not sales revenue or one current balance'], ['Period', data.from, data.to], ['Total Shop Cash Entered', data.summary.shopCashAmount], ['Total Boss Money Added', data.summary.bossAddedAmount], ['Total Cash Collected', data.summary.totalCollected], ['Average Daily Collection', data.summary.averageDailyCollection ?? 'No records'], ['Recorded Days', data.summary.recordedDays], [], ['Date', 'Shop Cash', 'Boss Added', 'Total Collected', 'Entered By', 'Notes', 'Revision'], ...data.rows.map(row => [row.businessDate, row.shopCashAmount, row.bossAddedAmount, row.totalCollected, row.enteredBy?.name ?? 'Former operator', row.notes, row.revision])], `manual-cash-${start}-${end}-page-${page}.csv`)
  }
  return <Panel className="manual-history" id="cash-history"><div className="cash-heading"><h2>Daily Cash History</h2>{data && <ExportMenu onExportPdf={() => window.print()} onExportExcel={exportPage} />}</div>
    <QueryFreshness query={query} label="cash history" onRetry={() => void query.refetch()} />
    <p>Totals cover saved entries in the selected period. Export includes the displayed history page.</p>
    <div className="cash-filters"><label>Period<select value={period} onChange={event => { setPeriod(event.target.value); setPage(1) }}>{[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom Date Range']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{period === 'custom' && <><label>From<input type="date" max={today} value={from} onChange={event => { setFrom(event.target.value); setPage(1) }} /></label><label>To<input type="date" min={from} max={today} value={to} onChange={event => { setTo(event.target.value); setPage(1) }} /></label></>}</div>
    {!ready ? <p>Saved history will appear here when Cash Book is available.</p> : !valid ? <p role="alert">Choose a valid range ending no later than today.</p> : query.isPending ? <p role="status">Loading saved manual cash records…</p> : query.isError && !data ? <p role="alert">{cashErrorMessage(query.error)} <Button onClick={() => void query.refetch()}>Retry</Button></p> : data && <>
      <div className="cash-stats">{[['Total Shop Cash Entered', data.summary.shopCashAmount], ['Total Boss Money Added', data.summary.bossAddedAmount], ['Total Cash Collected', data.summary.totalCollected], ['Average Daily Collection', data.summary.averageDailyCollection]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value === null || data.summary.recordedDays === 0 ? 'No records' : formatPKR(Number(value))}</strong></div>)}<div><span>Number of Recorded Days</span><strong>{data.summary.recordedDays}</strong></div></div>
      {data.rows.length === 0 ? <p className="cash-empty">No cash records found for this period.</p> : <table><caption className="sr-only">Saved manual daily cash entries</caption><thead><tr>{['Date', 'Shop Cash', 'Boss Added', 'Total Collected', 'Entered By', 'Notes', 'Actions'].map(label => <th scope="col" key={label} className={label === 'Actions' ? 'cash-actions-column' : undefined}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row._id}>{[row.businessDate, formatPKR(row.shopCashAmount), formatPKR(row.bossAddedAmount), formatPKR(row.totalCollected), row.enteredBy?.name ?? 'Former operator', row.notes || 'None'].map((value, index) => <td key={index} data-label={['Date', 'Shop Cash', 'Boss Added', 'Total Collected', 'Entered By', 'Notes'][index]}>{value}</td>)}<td data-label="Actions"><div className="cash-history-actions"><Button title="View record" aria-label={'View cash record for ' + row.businessDate} onClick={() => setDetails(row._id)}><Eye size={17} aria-hidden="true" /></Button><Button title={actionsDisabled ? 'Save or cancel the current draft first' : 'Edit record'} aria-label={'Edit cash record for ' + row.businessDate} disabled={actionsDisabled} onClick={() => setAction({ id: row._id, mode: 'edit' })}><SquarePen size={17} aria-hidden="true" /></Button><Button title={actionsDisabled ? 'Save or cancel the current draft first' : 'Delete record'} aria-label={'Delete cash record for ' + row.businessDate} className="cash-danger" disabled={actionsDisabled} onClick={() => setAction({ id: row._id, mode: 'void' })}><Trash2 size={17} aria-hidden="true" /></Button></div></td></tr>)}</tbody></table>}
      <div className="cash-pagination"><Button disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} · {data.total} recorded days</span><Button disabled={page * data.limit >= data.total || query.isFetching} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}
    {message && <SuccessToast message={message} onDismiss={() => setMessage('')} />}
    {details && <CashRecordDetails recordId={details} onClose={() => setDetails(null)} onCorrect={actionsDisabled ? undefined : () => setAction({ id: details, mode: 'edit' })} />}
    {action && <CashRecordAction recordId={action.id} action={action.mode} onClose={() => setAction(null)} onSaved={value => { setMessage(value); setAction(null) }} />}
  </Panel>
}
