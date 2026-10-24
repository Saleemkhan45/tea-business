import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button, PageContainer, Panel, StateBlock, SummaryCard, SuccessToast } from '../components/shared'
import { formatPKR } from '../business/utils/formatters'
import { useAuthStore } from '../features/auth/auth.store'
import { type LiveRegion } from '../features/regions/regionalInventory.api'
import { useRegionalOverview } from '../features/regions/regionalReports.api'
import { CatalogProductModal } from '../features/regions/components/CatalogProductModal'
import { RegionEditor } from '../features/regions/components/RegionEditor'
import { RegionDetails } from '../features/regions/components/RegionDetails'
import '../features/sales/sales.css'
import '../features/sales/responsive.css'
import '../features/regions/regions.css'

export function RegionsPage() {
  const [params, setParams] = useSearchParams(), client = useQueryClient()
  const selectedId = params.get('region') ?? ''
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const [editor, setEditor] = useState<LiveRegion | 'new' | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(() => params.get('catalog') === 'add')
  const [toast, setToast] = useState('')
  const query = useRegionalOverview()
  const role = useAuthStore(state => state.session?.user.role), canManage = role === 'owner' || role === 'admin'
  const rows = useMemo(() => (query.data ?? []).filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()) && (!status || row.status === status)), [query.data, search, status])
  async function saved() { setEditor(null); await client.invalidateQueries({ queryKey: ['regional'] }) }
  return <PageContainer className="sales-page regions-page">
    <div className="page-heading sales-page-heading"><div><div className="eyebrow">Regional operations</div><h1>{selectedId ? 'Region Details' : 'Regions'}</h1><p>Manage regional tea inventory, supplier receipts, sales and audited stock movements.</p></div><div className="page-actions">{selectedId && <Button onClick={() => setParams({})}>Back to Regions</Button>}<Button onClick={() => void client.invalidateQueries({ queryKey: ['regional'] })}>Refresh</Button>{canManage && <><Button onClick={() => setCatalogOpen(true)}>+ Catalog Product</Button><Button variant="primary" onClick={() => setEditor('new')}>+ Add Region</Button></>}</div></div>
    {!selectedId ? <><div className="summary-grid regional-summary-grid"><SummaryCard title="Total Regions" value={query.data ? String(query.data.length) : '?'} detail="Shop-owned regions" /><SummaryCard title="Available Regional Stock" value={query.data ? (query.data.reduce((sum, row) => sum + Math.round(row.stockKg * 1000), 0) / 1000).toLocaleString('en-PK') + ' kg' : '?'} detail="Current balances, including inactive regions" tone="green" /><SummaryCard title="Low Stock Alerts" value={query.data ? String(query.data.reduce((sum, row) => sum + row.lowStockProducts, 0)) : '?'} detail="Active products at or below threshold" tone="orange" /><SummaryCard title="Regional Sales" value={query.data ? formatPKR(query.data.reduce((sum, row) => sum + row.salesPkr, 0)) : '?'} detail="All time, excluding voided sales" /></div>
      <Panel className="regional-panel"><div className="regional-filter-grid"><label>Search Region<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by region name" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All regions</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
      {query.isPending ? <StateBlock variant="loading" title="Loading regions" message="" /> : query.isError ? <StateBlock variant="error" title="Regions unavailable" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Retry</Button>} /> : <div className="regional-card-grid">{rows.map(row => <article className="regional-region-card" key={row._id}><div className="regional-detail-heading"><h2>{row.name}</h2><Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</Badge></div><p>{row.city || 'Location not recorded'}</p><dl><div><dt>Available Stock</dt><dd>{row.stockKg.toLocaleString('en-PK')} kg</dd></div><div><dt>Sales</dt><dd>{formatPKR(row.salesPkr)}</dd></div><div><dt>Orders</dt><dd>{row.orders}</dd></div><div><dt>Low Stock Products</dt><dd>{row.lowStockProducts}</dd></div></dl><div className="page-actions"><Button variant="primary" onClick={() => setParams({ region: row._id })}>View Region Details</Button>{canManage && <Button onClick={() => setEditor(row)}>Edit</Button>}</div></article>)}</div>}{!query.isPending && !query.isError && rows.length === 0 && <StateBlock title="No regions found" message="Create a shop region or adjust the filters." />}</Panel>
    </> : <RegionDetails key={selectedId} regionId={selectedId} onEdit={setEditor} />}
    {catalogOpen && canManage && <CatalogProductModal receivingRegionId={selectedId || undefined} onClose={() => setCatalogOpen(false)} onSaved={() => { setCatalogOpen(false); setToast('Tea product saved successfully.') }} />}
    {toast && <SuccessToast message={toast} onDismiss={() => setToast('')} />}
    {editor && <RegionEditor region={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => void saved()} />}
  </PageContainer>
}
