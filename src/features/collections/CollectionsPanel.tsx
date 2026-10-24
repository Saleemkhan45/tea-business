import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, StateBlock, QueryFreshness, LoadingSpinner } from '../../components/shared'
import { getPakistanBusinessDate } from '../../business/utils/date'
import { formatPKR } from '../../business/utils/formatters'
import { collectionRequest, type Collection, type CollectionResult } from './collections.api'
import './collections.css'

const CustomerQuickActions = lazy(() => import('../customers/components/CustomerQuickActions').then(module => ({ default: module.CustomerQuickActions })))

function shift(date: string, count: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}
const LABELS: Record<string, string> = { due: 'Due Today', upcoming: 'Upcoming', overdue: 'Missed / Overdue',
  partial: 'Partially Collected', collected: 'Collected', cleared: 'Khata Cleared', acknowledged: 'Acknowledged' }

export function CollectionsPanel({ customerId, report = false }: { customerId?: string; report?: boolean }) {
  const today = getPakistanBusinessDate()
  const [period, setPeriod] = useState(customerId ? 'all' : 'today')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [status, setStatus] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [page, setPage] = useState(1)
  const [payment, setPayment] = useState<Collection | null>(null)
  const [feedback, setFeedback] = useState('')
  const [acknowledgment, setAcknowledgment] = useState<Collection | null>(null)
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('')
  const client = useQueryClient()
  const acknowledge = useMutation({ mutationFn: () => collectionRequest(`/${acknowledgment?.id}/acknowledgment`, { notes: acknowledgmentNotes }),
    onSuccess: async () => { setAcknowledgment(null); setAcknowledgmentNotes(''); setFeedback('Collection acknowledged. No payment was recorded.'); await client.invalidateQueries({ queryKey: ['collections'] }); await client.invalidateQueries({ queryKey: ['notifications'] }) } })
  const weekStart = shift(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const monthStart = `${today.slice(0, 7)}-01`
  const nextMonth = new Date(`${monthStart}T00:00:00Z`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  const bounds: Record<string, [string, string]> = {
    today: [today, today], tomorrow: [shift(today, 1), shift(today, 1)], week: [weekStart, shift(weekStart, 6)],
    month: [monthStart, shift(nextMonth.toISOString().slice(0, 10), -1)],
    overdue: [shift(today, -365), shift(today, -1)], all: [shift(today, -335), shift(today, 30)], custom: [from, to],
  }
  const [start, end] = bounds[period]
  const params = new URLSearchParams({ from: start, to: end, page: String(page), limit: '10' })
  if (customerId) params.set('customer', customerId)
  if (status || period === 'overdue') params.set('status', status || 'pending')
  if (customerFilter.trim()) params.set('search', customerFilter.trim())
  const query = useQuery({ queryKey: ['collections', 'list', params.toString()],
    queryFn: ({ signal }) => collectionRequest<CollectionResult>(`?${params}`, undefined, signal), refetchInterval: 60000 })
  const rows = query.data?.rows ?? []
  const title = report ? 'Khata Collection Report' : customerId ? 'Collection History' : "Today's Khata Collections"
  return <section id={!customerId && !report ? 'khata-collections' : undefined} className="collection-card" aria-label={title}>
    <div className="collection-heading"><div><h2>{title}</h2><p>Expected collections are separate from money actually received.</p></div><Button loading={query.isFetching} onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
    <div className="collection-filters">
      <label>Period<select value={period} onChange={e => { setPeriod(e.target.value); setPage(1) }}>
        <option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This Week</option><option value="month">This Month</option><option value="overdue">Overdue (past year)</option><option value="all">All Scheduled (past 335 / next 30 days)</option><option value="custom">Custom Date Range</option>
      </select></label>
      {period === 'custom' && <><label>From<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} /></label><label>To<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} /></label></>}
      <label>Collection status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">All statuses</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {report && <label>Customer<input type="search" maxLength={160} value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1) }} placeholder="Customer name" /></label>}
    </div>
    {feedback && <p role="status">{feedback}</p>}
    <QueryFreshness query={query} label="Khata collections" onRetry={() => void query.refetch()} />
    {query.isPending ? <StateBlock variant="loading" title="Loading collections" message="Retrieving saved schedules and ledger payments." /> : query.isError && !query.data ? <StateBlock variant="error" title="Collections unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} /> : <>
      {report && query.data && <div className="collection-totals"><p>Expected <strong>{formatPKR(query.data.totals.expected)}</strong></p><p>Received against these collections <strong>{formatPKR(query.data.totals.received)}</strong></p><p>Unpaid scheduled <strong>{formatPKR(query.data.totals.unpaid)}</strong></p><p>Completed {query.data.totals.collected} · Partial {query.data.totals.partial} · Missed {query.data.totals.overdue}</p></div>}
      {!rows.length && <p className="collection-empty">No collections match this selection.</p>}
      <div className="collection-list">{rows.map(row => <article key={row.id} className={`collection-row collection-${row.status}`}>
        <div><Link to={`/customers/${row.customerId}`}><strong>{row.customerName}</strong></Link><p>{row.phone || 'No phone recorded'}</p><time dateTime={row.scheduledDate}>{row.scheduledDate}</time><p>Last payment: {row.lastPaymentDate ? `${row.lastPaymentDate} · ${formatPKR(row.lastPaymentAmount ?? 0)}` : 'None recorded'}</p></div>
        <div><p>Khata <strong>{formatPKR(row.balance)}</strong></p><p>Expected {formatPKR(row.expectedAmount)}</p><p>Received {formatPKR(row.receivedAmount)} · Unpaid {formatPKR(row.unpaidAmount)}</p><span className="collection-status">{LABELS[row.status] ?? row.status}</span></div>
        <div className="collection-actions"><Button disabled={Boolean(row.projected) || row.balance <= 0 || ['collected', 'cleared'].includes(row.status)} onClick={() => setPayment(row)}>Receive Payment</Button><Link to={`/customers/${row.customerId}`}>View Customer / Payment History</Link>
          {['overdue', 'partial'].includes(row.status) && <Button onClick={() => { setAcknowledgment(row); setAcknowledgmentNotes('') }}>Acknowledge follow-up</Button>}
        </div>
      </article>)}</div>
      {query.data && query.data.total > 10 && <div className="collection-actions"><Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {Math.ceil(query.data.total / 10)}</span><Button disabled={page * 10 >= query.data.total} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </>}
    {acknowledgment && <form className="collection-form" onSubmit={event => { event.preventDefault(); acknowledge.mutate() }}><label>Follow-up notes for {acknowledgment.customerName}<textarea required maxLength={500} value={acknowledgmentNotes} onChange={e => setAcknowledgmentNotes(e.target.value)} /></label><div className="collection-actions"><Button type="submit" disabled={acknowledge.isPending || !acknowledgmentNotes.trim()}>Confirm acknowledgment</Button><Button type="button" disabled={acknowledge.isPending} onClick={() => setAcknowledgment(null)}>Cancel</Button></div>{acknowledge.isError && <p role="alert">{acknowledge.error.message}</p>}</form>}
    {payment && <Suspense fallback={<LoadingSpinner size="md" label="Loading payment form..." showLabel />}><CustomerQuickActions mode="payment" customerId={payment.customerId} customerName={payment.customerName} outstandingPkr={payment.balance} expectedAmount={payment.unpaidAmount} collectionOccurrence={payment.id} onClose={() => setPayment(null)} onSuccess={message => { setPayment(null); setFeedback(message); void query.refetch() }} /></Suspense>}
  </section>
}
