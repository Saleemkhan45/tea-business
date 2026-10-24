import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FilePlus2, Search } from 'lucide-react'
import { Badge, Button, PageContainer, Panel, SelectMenu, SummaryCard, Table, TableBody, TableHead } from '../components/shared'
import { AddSupplierModal } from '../features/suppliers/components/AddSupplierModal'
import { SupplierDetailsDrawer } from '../features/suppliers/components/SupplierDetailsDrawer'
import { SupplierActionsMenu } from '../features/suppliers/components/SupplierActionsMenu'
import { useSupplier, useSuppliers } from '../features/suppliers/supplier.api'
import { useAuthStore } from '../features/auth/auth.store'
import { useProducts, useRegions } from '../features/regions/regionalInventory.api'
import { getPakistanBusinessDate, shiftBusinessDate } from '../business/utils/date'
import '../features/sales/sales.css'
import '../features/sales/responsive.css'
import '../features/suppliers/suppliers.css'

const initial = { search: '', region: '', product: '', status: '', from: '', to: '' }
const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`
export function supplierPeriod(value: string, today = getPakistanBusinessDate()) {
  const first = `${today.slice(0, 7)}-01`
  if (value === 'today') return { from: today, to: today }
  if (value === 'week') return { from: shiftBusinessDate(today, -6), to: today }
  if (value === 'month') return { from: first, to: today }
  if (value === 'lastMonth') { const last = shiftBusinessDate(first, -1); return { from: `${last.slice(0, 7)}-01`, to: last } }
  return { from: '', to: '' }
}
export function SuppliersPage() {
  const role = useAuthStore(state => state.session?.user.role)
  const canManage = role === 'owner' || role === 'admin'
  const [filters, setFilters] = useState(initial), [period, setPeriod] = useState('all')
  const [action, setAction] = useState<{ id: string; mode: 'view' | 'edit' | 'purchases' | 'status' } | null>(null)
  const [adding, setAdding] = useState(false), [notice, setNotice] = useState('')
  const client = useQueryClient(), directory = useSuppliers(filters), lifetime = useSuppliers({})
  const edit = useSupplier(action?.mode === 'edit' || action?.mode === 'status' ? action.id : '')
  const regions = useRegions(), products = useProducts()
  const rows = directory.data?.suppliers ?? [], stats = directory.data?.stats
  function update(field: keyof typeof initial, value: string) { setFilters(current => ({ ...current, [field]: value })) }
  function reset() { setFilters(initial); setPeriod('all') }
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['suppliers'] }), client.invalidateQueries({ queryKey: ['purchases', 'options'] })]) }
  function saved() { reset(); setAction(null); setAdding(false); setNotice('Supplier saved successfully.'); void refresh() }
  function startAction(id: string, mode: NonNullable<typeof action>['mode']) {
    client.removeQueries({ queryKey: ['suppliers', 'detail', id] })
    setAction({ id, mode })
  }
  return <PageContainer className="sales-page suppliers-page">
    <div className="page-heading sales-page-heading"><div><div className="eyebrow">Supplier network</div><h1>Suppliers</h1><p>Manage supplier profiles, purchases and recorded invoice payables.</p></div>{canManage && <Button variant="primary" onClick={() => { setNotice(''); setAdding(true) }}><FilePlus2 size={16} /> Add Supplier</Button>}</div>
    {notice && <div className="supplier-toast" role="status">{notice}<button type="button" aria-label="Dismiss confirmation" onClick={() => setNotice('')}>×</button></div>}
    <div className="summary-grid suppliers-summary">
      <SummaryCard title="Total Suppliers" value={lifetime.data ? String(lifetime.data.suppliers.length) : '—'} detail="Current directory · all statuses" tone="blue" />
      <SummaryCard title="Active Suppliers" value={lifetime.data ? String(lifetime.data.suppliers.filter(row => row.status === 'active').length) : '—'} detail="Currently eligible for new purchases" tone="green" />
      <SummaryCard title="Purchased Quantity" value={stats ? `${stats.quantityKg.toLocaleString()} kg` : '—'} detail={`${filters.from || filters.to ? 'Selected period' : 'Lifetime'} · filtered suppliers · excludes voids`} tone="blue" />
      <SummaryCard title="Purchase Value" value={stats ? money(stats.valuePkr) : '—'} detail={`${filters.from || filters.to ? 'Selected period' : 'Lifetime'} · filtered suppliers · excludes voids`} tone="orange" />
      <SummaryCard title="Outstanding Payables" value={lifetime.data ? money(lifetime.data.stats.outstandingPkr) : '—'} detail="Current · regional invoices with recorded payments" tone="orange" />
    </div>
    {Boolean(lifetime.data?.stats.unknownPayableCount) && <p>Legacy invoices with unknown payment attribution: {lifetime.data?.stats.unknownPayableCount}. These are excluded from confirmed payables.</p>}
    {lifetime.isError && <p role="alert">Current supplier totals are unavailable. <Button onClick={() => void lifetime.refetch()}>Retry totals</Button></p>}
    <Panel className="sales-table-panel suppliers-table-panel report-style-table">
      <div className="sales-panel-heading"><div><h2>Supplier Directory</h2><p>{directory.data ? `${rows.length} suppliers matching your filters` : 'Shop-scoped supplier records'}</p></div><div className="supplier-toolbar"><Button onClick={reset}>Reset Filters</Button><Button disabled={directory.isFetching || lifetime.isFetching} onClick={() => void refresh()}>Refresh</Button></div></div>
      <div className="sales-filter-bar supplier-filters">
        <label className="search-input"><Search size={16} /><input aria-label="Search suppliers" placeholder="Name, contact or phone" value={filters.search} onChange={event => update('search', event.target.value)} /></label>
        <SelectMenu value={filters.region} onChange={value => update('region', value)} options={[{ value: '', label: 'All service regions' }, ...(regions.data ?? []).map(row => ({ value: row._id, label: row.name }))]} ariaLabel="Filter suppliers by region" searchable floating />
        <SelectMenu value={filters.product} onChange={value => update('product', value)} options={[{ value: '', label: 'All supplied products' }, ...(products.data ?? []).map(row => ({ value: row._id, label: `${row.name} / ${row.teaType}` }))]} ariaLabel="Filter suppliers by product" searchable floating />
        <SelectMenu value={filters.status} onChange={value => update('status', value)} options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} ariaLabel="Filter suppliers by status" floating />
      </div>
      {(regions.isError || products.isError) && <p role="alert">Filter options unavailable. <Button onClick={() => { void regions.refetch(); void products.refetch() }}>Retry options</Button></p>}
      <div className="supplier-period"><label>Purchase period<select value={period} onChange={event => { const value = event.target.value; setPeriod(value); setFilters(current => ({ ...current, ...supplierPeriod(value) })) }}><option value="all">Lifetime</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">This Month</option><option value="lastMonth">Last Month</option><option value="custom">Custom Date Range</option></select></label>{period === 'custom' && <><label>From<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label><label>To<input type="date" min={filters.from} value={filters.to} onChange={event => update('to', event.target.value)} /></label></>}<small>Purchase dates filter statistics and history. Service regions filter supplier profiles.</small></div>
      {directory.isPending && <div className="supplier-skeleton" role="status">Loading suppliers...</div>}
      {directory.isError && <div className="supplier-state" role="alert"><p>{directory.error.message}</p><Button onClick={() => void directory.refetch()}>Retry suppliers</Button></div>}
      {directory.data && !directory.isError && <><Table><TableHead><tr><th>Supplier / Contact</th><th>Service Regions</th><th>Products Supplied</th><th>Purchased kg</th><th>Purchase Value</th><th>Last Purchase</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></TableHead><TableBody>{rows.map(row => <tr key={row._id}><td><div className="supplier-cell"><span className="supplier-avatar">{row.name.slice(0, 2).toUpperCase()}</span><div><button className="text-link" onClick={() => startAction(row._id, 'view')}>{row.name}</button><span>{row.contactPerson || row.phone || 'No contact provided'}</span></div></div></td><td>{row.regions.map(id => regions.data?.find(region => region._id === id)?.name ?? id).join(', ') || 'Not configured'}</td><td>{row.productOfferings?.length ?? 0} offerings / {row.products.length} catalog products</td><td>{row.stats.quantityKg.toLocaleString()}</td><td>{money(row.stats.valuePkr)}</td><td>{row.stats.lastPurchase ?? 'No purchases'}</td><td><Badge tone={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge></td><td><SupplierActionsMenu status={row.status} canManage={canManage} name={row.name} onAction={mode => startAction(row._id, mode)} /></td></tr>)}</TableBody></Table>{!rows.length && <div className="supplier-state"><h3>No suppliers found</h3><p>Add a supplier or adjust your filters.</p><Button onClick={reset}>Reset Filters</Button></div>}<div className="table-footer">Showing {rows.length} suppliers · purchase totals include non-void invoices</div></>}
    </Panel>
    {adding && <AddSupplierModal onClose={() => setAdding(false)} onSave={saved} onViewExisting={id => { setAdding(false); startAction(id, 'view'); void refresh() }} />}
    {action && (action.mode === 'view' || action.mode === 'purchases') && <SupplierDetailsDrawer key={action.id} onViewExisting={id => startAction(id, 'view')} canManage={canManage} id={action.id} from={filters.from} to={filters.to} purchasesOnly={action.mode === 'purchases'} onClose={() => setAction(null)} />}
    {action && (action.mode === 'edit' || action.mode === 'status') && (!edit.data ? <div className="modal-backdrop"><section className="sale-modal supplier-loading" role="dialog" aria-modal="true" aria-label="Load supplier for editing"><p role={edit.isError ? 'alert' : 'status'}>{edit.isError ? edit.error.message : 'Loading current supplier record...'}</p>{edit.isError && <Button onClick={() => void edit.refetch()}>Retry</Button>}<Button onClick={() => setAction(null)}>Close</Button></section></div> : <AddSupplierModal key={`${action.id}-${action.mode}`} supplier={action.mode === 'status' ? { ...edit.data.supplier, status: edit.data.supplier.status === 'active' ? 'inactive' : 'active' } : edit.data.supplier} onClose={() => setAction(null)} onSave={saved} onViewExisting={id => { setAdding(false); startAction(id, 'view'); void refresh() }} />)}
  </PageContainer>
}



