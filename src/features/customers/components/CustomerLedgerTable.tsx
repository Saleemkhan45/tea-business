import { useState, type FormEvent } from 'react'
import type { CustomerLedgerTransaction, LedgerRow } from '../../../business/domain/customer-ledger.types'
import type { BusinessDate } from '../../../business/domain/types'
import { formatBusinessDate, isValidBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Badge, Button, Panel, SelectMenu, StateBlock, Table, TableBody, TableHead } from '../../../components/shared'
import type { LedgerFilters } from '../../customer-ledger'
import { formatLedgerQuantity } from '../utils/customerLedgerUi'

type Props = {
  rows?: LedgerRow[]
  transactions?: CustomerLedgerTransaction[]
  filters: LedgerFilters
  today: BusinessDate
  isPending: boolean
  isError: boolean
  onFiltersChange: (filters: LedgerFilters) => void
  onRetry: () => void
}

const TYPE_LABELS = { purchase: 'Sale', payment: 'Payment', opening_balance: 'Opening balance', adjustment: 'Adjustment', return: 'Return' } as const
const RECORDED_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi', dateStyle: 'short', timeStyle: 'short',
})

export function CustomerLedgerTable({ rows, transactions, filters, today, isPending, isError, onFiltersChange, onRetry }: Props) {
  const [from, setFrom] = useState(filters.from ?? '')
  const [to, setTo] = useState(filters.to ?? '')
  const [search, setSearch] = useState('')
  const invalidRange = Boolean((from && !isValidBusinessDate(from)) || (to && !isValidBusinessDate(to)) || (from && to && from > to))
  const transactionById = new Map((transactions ?? []).map(transaction => [transaction.id, transaction]))
  const visibleRows = (rows ?? []).filter(row =>
    (!filters.from || row.businessDate >= filters.from)
    && (!filters.to || row.businessDate <= filters.to)
    && (!filters.type || row.type === filters.type)
    && (!filters.status || row.status === filters.status)
    && (!filters.teaType || row.teaType === filters.teaType)
    && [transactionById.get(row.transactionId)?.productName, transactionById.get(row.transactionId)?.reference,
      transactionById.get(row.transactionId)?.notes, transactionById.get(row.transactionId)?.enteredByName, TYPE_LABELS[row.type]]
      .some(value => value?.toLowerCase().includes(search.trim().toLowerCase())))

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (invalidRange) return
    onFiltersChange({ ...filters, from: from || undefined, to: to || undefined })
  }

  function clearFilters() {
    setFrom('')
    setTo('')
    onFiltersChange({})
  }

  return <Panel className="customer-ledger-panel" aria-label="Customer ledger">
    <div className="customer-section-heading"><div><h2>Khata Ledger</h2></div><span className="customer-row-count">{visibleRows.length} transactions</span></div>
    <form className="customer-ledger-filters" onSubmit={applyFilters}>
      <label>Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference, description or operator" /></label>
      <label>From<input type="date" max={to || today} value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>To<input type="date" min={from || undefined} max={today} value={to} onChange={event => setTo(event.target.value)} /></label>
      <SelectMenu value={filters.type ?? ''} options={[{ value: '', label: 'All transaction types' }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]} onChange={value => onFiltersChange({ ...filters, type: value ? value as LedgerFilters['type'] : undefined })} ariaLabel="Filter ledger transaction type" />
      <SelectMenu value={filters.teaType ?? ''} options={[{ value: '', label: 'All tea types' }, { value: 'green', label: 'Green Tea' }, { value: 'black', label: 'Black Tea' }, { value: 'jasmine', label: 'Jasmine Tea' }, { value: 'herbal', label: 'Herbal Blend' }]} onChange={value => onFiltersChange({ ...filters, teaType: value ? value as LedgerFilters['teaType'] : undefined })} ariaLabel="Filter ledger tea type" />
      <Button type="submit" disabled={invalidRange}>Apply</Button>
      {(filters.from || filters.to || filters.type || filters.teaType) && <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>}
      {invalidRange && <span role="alert" className="customer-form-error">Choose a valid range with the start on or before the end.</span>}
    </form>
    {isPending ? <StateBlock variant="loading" title="Loading ledger" message="Fetching account transactions." />
      : isError ? <StateBlock variant="error" title="Ledger unavailable" message="Try loading transactions again." action={<button className="text-link" type="button" onClick={onRetry}>Retry</button>} />
        : visibleRows.length === 0 ? <StateBlock title="No ledger transactions" message={filters.from || filters.to || filters.type || filters.teaType ? 'No entries match these filters.' : 'Purchases and payments will appear here when recorded.'} />
          : <Table className="customer-ledger-table"><caption className="sr-only">Customer ledger transactions</caption><TableHead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Detail</th><th scope="col">Quantity</th><th scope="col">Rate</th><th scope="col">Debit</th><th scope="col">Credit</th><th scope="col">Balance</th><th scope="col">Method</th><th scope="col">Entered By</th><th scope="col">Status</th></tr></TableHead><TableBody>{visibleRows.map(row => {
            const transaction = transactionById.get(row.transactionId)
            const description = transaction?.productName || (transaction?.type === 'adjustment' ? transaction.reason : row.type === 'payment' ? 'Payment Received' : row.type === 'opening_balance' ? 'Opening balance' : row.teaType ? `${row.teaType} tea` : TYPE_LABELS[row.type])
            return <tr key={row.transactionId} className={row.status === 'voided' ? 'is-voided' : ''}>
              <td>{formatBusinessDate(row.businessDate)}<small>{RECORDED_DATE_FORMAT.format(new Date(row.createdAt))}</small></td>
              <td><Badge tone={row.type === 'payment' ? 'success' : row.type === 'adjustment' ? 'warning' : 'neutral'}>{TYPE_LABELS[row.type]}</Badge></td>
              <td className="customer-ledger-description"><strong>{description}</strong>{transaction?.notes && <small>{transaction.notes}</small>}{transaction?.reference && <small>Receipt: {transaction.reference}</small>}{transaction?.status === 'voided' && <small>Void: {transaction.voidReason}</small>}</td>
              <td>{row.quantityKg === null ? '-' : formatLedgerQuantity(row.quantityKg)}</td>
              <td>{row.ratePerKgPkr === null ? '-' : formatPKR(row.ratePerKgPkr)}</td>
              <td className="customer-debit"><strong>{row.balanceImpactPkr > 0 ? formatPKR(row.balanceImpactPkr) : '-'}</strong></td>
              <td className="customer-credit"><strong>{row.balanceImpactPkr < 0 ? formatPKR(-row.balanceImpactPkr) : '-'}</strong></td>
              <td><strong>{formatPKR(Math.abs(row.runningBalancePkr))}{row.runningBalancePkr < 0 ? ' Credit' : ''}</strong></td>
              <td>{transaction?.salePaymentMethod === 'credit' ? 'Khata' : (row.paymentMethod ?? transaction?.salePaymentMethod)?.replace('_', ' ') ?? '-'}</td>
              <td>{transaction?.enteredByName ?? '-'}</td>
              <td><Badge tone={row.status === 'voided' ? 'danger' : 'success'}>{row.status === 'voided' ? 'Voided' : 'Active'}</Badge></td>
            </tr>
          })}</TableBody></Table>}
  </Panel>
}
