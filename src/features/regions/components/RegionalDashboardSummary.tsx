import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LazyAnalyticsChart } from '../../../components/shared/LazyAnalyticsChart'
import { Button, Panel, SelectMenu, StateBlock, SummaryCard, QueryFreshness } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { useRegions } from '../regionalInventory.api'
import { useRegionalOverview, useRegionReport } from '../regionalReports.api'
import { RegionSelector } from './RegionSelector'
import { RegionalRevenue } from './RegionalRevenue'

export function RegionalDashboardSummary({ from, to, regionId, onRegionChange }: { from: string; to: string; regionId: string; onRegionChange: (value: string) => void }) {
  const [comparison, setComparison] = useState('salesPkr')
  const [detailOpen, setDetailOpen] = useState(false)
  const regions = useRegions(), overview = useRegionalOverview(from, to), detail = useRegionReport(regionId, from, to, '', detailOpen)
  const rows = (overview.data ?? []).filter(row => !regionId || row._id === regionId)
  const chart = rows.map(row => ({ name: row.name, salesPkr: row.salesPkr, quantityKg: row.quantityKg, stockKg: row.stockKg }))
  return <Panel className="regional-panel"><div className="regional-detail-heading"><div><h2>Regional Stock and Sales</h2><p>{from} to {to} · recorded sales, excluding cancellations</p></div><Link to="/regions">Manage regions</Link></div><div className="regional-report-filter"><RegionSelector label="Dashboard Region" regions={regions} value={regionId} onChange={onRegionChange} required={false} includeInactive floating placeholder="All regions" description="" /></div>
    <div className="dashboard-freshness-slot"><QueryFreshness query={overview} label="regional figures" onRetry={() => void overview.refetch()} /></div>
    {overview.isPending ? <div className="regional-loading" role="status" aria-label="Loading regional summary"><div className="summary-grid regional-summary-grid">{[0, 1, 2].map(index => <div key={index} className="summary-card loading-block" aria-hidden="true" />)}</div><div className="dashboard-chart-placeholder is-loading" aria-hidden="true" /></div> : overview.isError && !overview.data ? <StateBlock variant="error" title="Regional summary unavailable" message={overview.error.message} action={<Button onClick={() => void overview.refetch()}>Retry</Button>} /> : <>
      <div className="summary-grid regional-summary-grid"><SummaryCard title="Regional Sales" value={formatPKR(rows.reduce((sum, row) => sum + row.salesPkr, 0))} detail="Selected period and regions" /><SummaryCard title="Regional Quantity Sold" value={(rows.reduce((sum, row) => sum + Math.round(row.quantityKg * 1000), 0) / 1000).toLocaleString('en-PK') + ' kg'} detail="Selected period and regions" tone="green" /><SummaryCard title="Current Regional Stock" value={(rows.reduce((sum, row) => sum + Math.round(row.stockKg * 1000), 0) / 1000).toLocaleString('en-PK') + ' kg'} detail="Current available balance · active inventory" tone="orange" /></div>
      <SelectMenu value={comparison} onChange={setComparison} options={[{ value: 'salesPkr', label: 'Regional sales (PKR)' }, { value: 'stockKg', label: 'Current regional stock (kg)' }]} ariaLabel="Regional comparison" />
      {comparison === 'stockKg' && (chart.length > 0 ? <div className="regional-chart dashboard-chart" role="img" aria-label="Current stock by selected region. Full figures below."><LazyAnalyticsChart points={chart.map(row => ({ label: row.name, value: row.stockKg }))} name="Current stock (kg)" /></div> : <p role="status">No regions available for this selection.</p>)}
      {rows.length > 0 && <details className="regional-values"><summary>View region figures</summary><ul>{rows.map(row => <li key={row._id}><strong>{row.name}</strong><span>{formatPKR(row.salesPkr)} sales · {row.quantityKg.toLocaleString('en-PK')} kg sold · {row.stockKg.toLocaleString('en-PK')} kg current stock</span></li>)}</ul></details>}
      {regionId && <details open={detailOpen} onToggle={event => setDetailOpen(event.currentTarget.open)}><summary>Daily sales for this region</summary>
        {detail.isPending && detailOpen && <p role="status">Loading daily sales…</p>}
        {detail.isError && <p role="alert">Daily region details unavailable. <Button onClick={() => void detail.refetch()}>Retry details</Button></p>}
        {detail.data?.daily.map(day => <p key={day.name}>{day.name}: {formatPKR(day.salesPkr)} · {day.quantityKg} kg</p>)}
        {detail.data?.daily.length === 0 && <p>No daily sales in the selected period.</p>}
      </details>}
    </>}
    {comparison === 'salesPkr' && <RegionalRevenue from={from} to={to} regionId={regionId} region={regionId ? regions.data?.find(row => row._id === regionId)?.name ?? 'Selected region' : 'All Regions'} />}
  </Panel>
}


