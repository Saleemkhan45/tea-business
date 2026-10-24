import { useMemo, useState } from 'react'
import { Boxes, RefreshCw, Search } from 'lucide-react'
import { Badge, Button, PageContainer, Panel, StateBlock, SummaryCard, Table, TableBody, TableHead } from '../components/shared'
import { formatPKR } from '../business/utils/formatters'
import { filterRegionalInventory, useRegionalInventory, useRegions } from '../features/regions/regionalInventory.api'
import { RegionSelector } from '../features/regions/components/RegionSelector'
import '../features/sales/sales.css'
import '../features/sales/responsive.css'
import '../features/inventory/inventory.css'

export function InventoryPage() {
  const inventory = useRegionalInventory()
  const regions = useRegions()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [status, setStatus] = useState('')
  const rows = useMemo(() => filterRegionalInventory(inventory.data ?? [], search, region, status), [inventory.data, search, region, status])
  const available = rows.filter(row => row.status === 'available')
  const totalGrams = available.reduce((sum, row) => sum + Math.round(row.availableKg * 1000), 0)
  return <PageContainer className="sales-page inventory-page">
    <div className="page-heading sales-page-heading">
      <div>
        <div className="eyebrow">
          <span className="pulse" /> Stock control</div>
        <h1>Inventory</h1>
        <p>Independent stock balances for each region and tea product.</p>
      </div>
      <div className="page-actions">
        <a className="text-link" href="/regions">Manage region stock</a>
        <Button aria-label="Refresh inventory" disabled={inventory.isFetching} onClick={() => { void inventory.refetch(); void regions.refetch() }}>
          <RefreshCw size={17} /> Refresh</Button>
      </div>
    </div>
    <div className="summary-grid">
      <SummaryCard title="Available Regional Stock" value={`${(totalGrams / 1000).toLocaleString('en-PK')} kg`} detail="Active products in active regions" tone="blue" />
      <SummaryCard title="Product / Region Balances" value={String(rows.length)} detail="Each row is an independent balance" tone="green" />
      <SummaryCard title="Out of Stock" value={String(rows.filter(row => row.status === 'out_of_stock').length)} detail="Record a receipt in Regions" tone="orange" />
    </div>
    <Panel className="sales-table-panel inventory-table-panel">
      <div className="sales-panel-heading">
        <div>
          <h2>Regional Inventory</h2>
          <p>Legacy unallocated stock is excluded. Quantities are never assigned automatically.</p>
        </div>
      </div>
      <div className="sales-filter-bar inventory-filter-bar">
        <label className="search-input">
          <Search size={16} />
          <input aria-label="Search inventory" placeholder="Search product name" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <RegionSelector label="Inventory Region" regions={regions} value={region} onChange={setRegion} required={false} floating placeholder="All Regions" description="" />
        <select aria-label="Filter inventory by availability" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="inactive">Inactive</option>
        </select>
        <Button onClick={() => { setSearch(''); setRegion(''); setStatus('') }}>Reset filters</Button>
      </div>
      {inventory.isPending ? <StateBlock variant="loading" title="Loading regional inventory" message="Fetching stock balances." /> : inventory.isError ? <StateBlock variant="error" title="Inventory unavailable" message={inventory.error.message} action={<Button onClick={() => void inventory.refetch()}>Retry</Button>} /> : <>
        <Table>
          <TableHead>
            <tr>
              <th>Product Name</th>
              <th>Tea Type</th>
              <th>Region</th>
              <th>Available Stock (kg)</th>
              <th>Selling Price</th>
              <th>Stock Status</th>
              <th>Last Updated</th>
            </tr>
          </TableHead>
          <TableBody>{rows.map(row => <tr key={row.id}>
            <td>
              <strong>{row.name}</strong>
            </td>
            <td>{row.teaType}</td>
            <td>
              <a href={`/regions?region=${row.regionId}`}>{row.regionName}</a>
            </td>
            <td>{row.availableKg.toLocaleString('en-PK')} kg</td>
            <td>{row.sellingPrice === null ? 'Not configured' : formatPKR(row.sellingPrice)}</td>
            <td>
              <Badge tone={row.status === 'available' && !(row.lowStockThreshold != null && row.availableKg <= row.lowStockThreshold) ? 'success' : 'warning'}>{row.status === 'available' && row.lowStockThreshold != null && row.availableKg <= row.lowStockThreshold ? 'Low stock' : row.status.replaceAll('_', ' ')}</Badge>
            </td>
            <td>{new Date(row.updatedAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</td>
          </tr>)}</TableBody>
        </Table>{rows.length === 0 && <StateBlock title="No regional inventory found" message="Assign a catalog product to a region and record genuine stock in Regions, or adjust your filters." icon={<Boxes size={21} />} />}</>}
      {regions.isError && <p role="alert">Region filters unavailable. <Button onClick={() => void regions.refetch()}>Retry regions</Button>
      </p>}
    </Panel>
  </PageContainer>
}
