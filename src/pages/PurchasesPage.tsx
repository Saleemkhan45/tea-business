import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Button, Badge, PageContainer, Panel, StateBlock, SummaryCard, Table, TableHead, TableBody } from '../components/shared'
import { formatPKR } from '../business/utils/formatters'
import { getPakistanBusinessDate } from '../business/utils/date'
import { useAuthStore } from '../features/auth/auth.store'
import { RegionSelector } from '../features/regions/components/RegionSelector'
import { useRegions } from '../features/regions/regionalInventory.api'
import { AddPurchaseModal } from '../features/purchases/components/AddPurchaseModal'
import { usePurchases, useInvalidatePurchases, writePurchase } from '../features/purchases/purchase.api'
import type { PurchaseDto } from '../features/purchases/types/purchaseApi'
import '../features/sales/sales.css'
import '../features/regions/regions.css'
import '../features/customers/customers.css'
import '../features/purchases/purchases.css'

export function PurchasesPage({ historyOnly = false }: { historyOnly?: boolean }) {
  const location = useLocation()
  const recordId = new URLSearchParams(location.search).get('record')
  const recordRef = useRef<HTMLTableRowElement>(null)
  const [region, setRegion] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  useEffect(() => { if (recordId) { setRegion(''); setSearch(''); setStatus(''); setFrom(''); setTo('') } }, [recordId, location.key])
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<PurchaseDto | null>(null)
  const [action, setAction] = useState<'receive' | 'void' | 'payments'>('receive')
  const [reason, setReason] = useState(''), [amount, setAmount] = useState(''), [method, setMethod] = useState('cash')
  const frozen = useRef<{ path: string; body: object } | null>(null)
  const query = usePurchases(region), regions = useRegions(), invalidate = useInvalidatePurchases()
  const role = useAuthStore(state => state.session?.user.role)
  const canManage = role === 'owner' || role === 'admin'
  useEffect(() => { if (!historyOnly && new URLSearchParams(location.search).get('action') === 'add') setAdding(true) }, [location.search, historyOnly])
  const mutation = useMutation({ mutationFn: ({ path, body }: { path: string; body: object }) => writePurchase(path, body), retry: false, onSuccess: async () => { frozen.current = null; setSelected(null); await invalidate() } })
  const rows = useMemo(() => (query.data ?? []).filter(row => (!status || row.status === status) && (!from || row.businessDate >= from) && (!to || row.businessDate <= to) && [row.supplierName, row.productName, row.reference, row.regionName, row._id].join(' ').toLowerCase().includes(search.trim().toLowerCase())), [query.data, status, from, to, search])
  useEffect(() => { recordRef.current?.scrollIntoView?.({ block: 'center' }); recordRef.current?.focus() }, [rows, recordId])
  const active = rows.filter(row => row.status !== 'voided')
  function open(row: PurchaseDto, next: typeof action) { frozen.current = null; mutation.reset(); setSelected(row); setAction(next); setReason(''); setAmount(''); setMethod('cash') }
  async function confirm() {
    if (!selected || mutation.isPending) return
    frozen.current ??= { path: '/' + selected._id + '/' + action, body: action === 'void' ? { reason } : action === 'payments' ? { amountPkr: Number(amount), method, businessDate: getPakistanBusinessDate(), idempotencyKey: crypto.randomUUID() } : {} }
    try { await mutation.mutateAsync(frozen.current) } catch { /* Frozen intent is kept for retries. */ }
  }
  return <PageContainer className="sales-page purchases-page">
    <div className="page-heading"><div><div className="eyebrow">Regional procurement</div><h1>{historyOnly ? 'Purchase History' : 'Purchases'}</h1><p>Supplier purchases, confirmed regional receipts and recorded payments.</p></div><div className="page-actions"><Button onClick={() => void query.refetch()}>Refresh</Button>{canManage && !historyOnly && <Button variant="primary" onClick={() => setAdding(true)}>+ Add Purchase</Button>}</div></div>
    <div className="summary-grid regional-summary-grid"><SummaryCard title="Purchase Value" value={formatPKR(active.reduce((sum, row) => sum + row.totalAmount, 0))} detail="Selected records, excluding reversals" /><SummaryCard title="Received Quantity" value={(active.filter(row => row.status === 'received').reduce((sum, row) => sum + Math.round(row.quantityKg * 1000), 0) / 1000).toLocaleString('en-PK') + ' kg'} detail="Confirmed received purchases" tone="green" /><SummaryCard title="Recorded Supplier Payments" value={formatPKR(active.reduce((sum, row) => sum + row.paidAmount, 0))} detail="Payments attached to these purchases" tone="orange" /></div>
    <Panel className="regional-panel"><div className="regional-filter-grid"><label>Search purchases<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Supplier, product or invoice" /></label><RegionSelector label="Receiving Region" value={region} onChange={setRegion} regions={regions} required={false} includeInactive placeholder="All receiving regions" description="" /><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['received', 'pending', 'in_transit', 'voided'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      {query.isPending ? <StateBlock variant="loading" title="Loading purchases" message="" /> : query.isError ? <StateBlock variant="error" title="Purchases unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} /> : rows.length === 0 ? <StateBlock title="No purchases found" message="Add a genuine supplier purchase or adjust the filters." /> : <Table><TableHead><tr><th>Date / Reference</th><th>Supplier</th><th>Receiving Region</th><th>Tea Product</th><th>Quantity</th><th>Total</th><th>Paid / Due</th><th>Status</th><th>Actions</th></tr></TableHead><TableBody>{rows.map(row => <tr key={row._id} ref={row._id === recordId ? recordRef : undefined} tabIndex={row._id === recordId ? -1 : undefined} style={row._id === recordId ? { background: '#eff6ff', outline: '2px solid #2563eb' } : undefined}><td>{row.businessDate}<small className="regional-cell-detail">{row.reference || row._id}</small></td><td>{row.supplierName || 'Historical supplier'}</td><td>{row.regionName || 'Legacy unallocated'}</td><td>{row.productName || 'Historical product'}<details open={row._id === recordId || undefined}><summary>Details</summary><p>{row.notes || 'No notes'}</p><p>Unit cost: {row.unitCost === undefined ? 'Not recorded' : formatPKR(row.unitCost)}</p>{row.payments?.map((payment, index) => <p key={index}>{payment.businessDate}: {formatPKR(payment.amountPkr)} ({payment.method})</p>)}</details></td><td>{row.quantityKg} kg</td><td>{formatPKR(row.totalAmount)}</td><td>{!row.receivingRegion ? 'Legacy payments not recorded' : <>{formatPKR(row.paidAmount)} / {row.status === 'voided' ? 'Reversed' : formatPKR(row.totalAmount - row.paidAmount)}</>}</td><td><Badge tone={row.status === 'received' ? 'success' : row.status === 'voided' ? 'danger' : 'warning'}>{row.status.replaceAll('_', ' ')}</Badge></td><td>{canManage && row.receivingRegion && row.status !== 'voided' && <div className="regional-row-actions">{row.status !== 'received' && <Button onClick={() => open(row, 'receive')}>Receive</Button>}{row.paidAmount < row.totalAmount && <Button onClick={() => open(row, 'payments')}>Record payment</Button>}<Button onClick={() => open(row, 'void')}>Reverse</Button></div>}</td></tr>)}</TableBody></Table>}
    </Panel>
    {selected && <Panel className="regional-panel regional-confirm" role="region" aria-label="Confirm purchase action"><h2>{action === 'receive' ? 'Confirm stock receipt' : action === 'void' ? 'Confirm purchase reversal' : 'Record supplier payment'}</h2><p>{selected.productName} ? {selected.quantityKg} kg ? {selected.regionName}</p><fieldset disabled={mutation.isPending || Boolean(frozen.current)}>{action === 'void' ? <label>Reason<input maxLength={240} value={reason} onChange={event => setReason(event.target.value)} /></label> : action === 'payments' ? <><label>Payment Amount (PKR)<input type="number" min="1" step="1" max={selected.totalAmount - selected.paidAmount} value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Payment Method<select value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option></select></label></> : <p>Only this receiving region will gain stock. This action is recorded once.</p>}</fieldset>{mutation.isError && <p role="alert">{mutation.error.message} Retry uses the same request.</p>}<div className="page-actions"><Button disabled={mutation.isPending} onClick={() => setSelected(null)}>Cancel</Button><Button variant="primary" disabled={mutation.isPending || (action === 'void' && !reason.trim()) || (action === 'payments' && (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || Number(amount) > selected.totalAmount - selected.paidAmount))} onClick={() => void confirm()}>{mutation.isError ? 'Retry same action' : 'Confirm'}</Button></div></Panel>}
    {adding && <AddPurchaseModal onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />}
  </PageContainer>
}
