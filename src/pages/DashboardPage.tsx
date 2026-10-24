import { DashboardConnectionStatus } from '../features/dashboard/components/DashboardConnectionStatus'
import { CashPanel } from '../features/cashbook/CashPanel'
import { memo, useState } from 'react'
import { CollectionsPanel } from '../features/collections/CollectionsPanel'
import { Boxes, PackageSearch, ReceiptText, RefreshCw, ShoppingCart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, DateRangeMenu, ExportMenu, getDefaultDateRange, PageContainer, Panel, RevealOnScroll, StatCard, LoadingSpinner } from '../components/shared'
import type { DateRangeValue } from '../components/shared'
import { ActiveOrders, CategoryStatistics, SalesOverview, SalesPerformance, TeaSales } from '../features/dashboard'
import { useDashboard } from '../features/dashboard/services/dashboard.service'
import { dashboardRefreshKeys } from '../features/dashboard/queryPolicy'
import { formatDashboardPkr } from '../features/dashboard/formatters'
import { RegionalDashboardSummary } from '../features/regions/components/RegionalDashboardSummary'
import { useTopSellingProducts } from '../features/sales/useSales'
import '../features/regions/regions.css'
import '../features/dashboard/dashboard.css'

const DashboardValue = memo(function DashboardValue({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(value)}</>
})

export function DashboardPage() {
  const client = useQueryClient()
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange)
  const [dashboardRegionId, setDashboardRegionId] = useState('')
  const filters = { from: dateRange.startDate, to: dateRange.endDate, regionId: dashboardRegionId || undefined }
  const dashboard = useDashboard(filters)
  const topProducts = useTopSellingProducts(filters)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [notice, setNotice] = useState('')
  const data = dashboard.data, metrics = data?.metrics
  async function refreshDashboard() {
    if (isRefreshing) return
    setIsRefreshing(true); setNotice('')
    try {
      await Promise.all(dashboardRefreshKeys.map(queryKey => client.invalidateQueries({ queryKey }, { throwOnError: true })))
      setNotice('Dashboard refreshed.')
    } catch { setNotice('Refresh failed. Please retry; previously loaded values may be outdated.') }
    finally { setIsRefreshing(false) }
  }
  function exportExcel() {
    if (!data) return
    const rows = [['Metric', 'Value'], ['Period', `${data.from} to ${data.to}`], ['Region ID', data.regionId || 'All regions'], ['Total Orders', data.metrics.orders], ['Total Sales (PKR)', data.metrics.salesPkr], ['Average Order (PKR)', data.metrics.averageOrderPkr], ['Current Stock (kg)', data.metrics.stockKg]]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `dashboard-${data.from}-${data.to}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const categories = (data?.categories ?? []).map((row, index) => ({ ...row, color: ['#3979f6', '#f59e0b', '#22a777', '#9266ef', '#e45688', '#64748b'][index % 6], tone: 'blue' as const }))
  const value = (number: number | undefined, format: (value: number) => string) => number == null ? (dashboard.isPending ? <span className="kpi-skeleton" aria-hidden="true" /> : '—') : <DashboardValue key={`${filters.from}:${filters.to}:${filters.regionId ?? ''}`} value={number} format={format} />
  return <PageContainer className="dashboard-page">
    <div className="page-heading dashboard-heading dashboard-header"><div className="dashboard-title"><h1>Dashboard</h1></div><div className="page-actions"><Button onClick={() => void refreshDashboard()} loading={isRefreshing} disabled={isRefreshing} aria-label="Refresh dashboard data"><RefreshCw size={16} />{isRefreshing ? 'Refreshing...' : 'Refresh'}</Button><ExportMenu onExportPdf={() => window.print()} onExportExcel={exportExcel} /><DateRangeMenu value={dateRange} onChange={setDateRange} /></div></div>
    <div className="dashboard-meta">
    <p className="dashboard-scope">{dateRange.label} · {dateRange.startDate} to {dateRange.endDate} · {dashboardRegionId ? 'Selected selling region' : 'All regions'}</p>
    <details className="dashboard-scope-note"><summary>About these figures</summary><p>Dates follow Asia/Karachi. Sales cover the selected period; stock is the current available balance in active regional inventory. All-region sales include historical unallocated sales; regional comparisons show assigned sales only.</p></details>
    <p className="dashboard-notice" role="status">{notice}</p>
    <div className="dashboard-freshness-slot"><DashboardConnectionStatus query={dashboard} onRetry={() => void dashboard.refetch()} /></div>
    </div>
    <RevealOnScroll className={`stats-grid dashboard-stats-grid${dashboard.isPending ? ' dashboard-kpi-skeleton' : ''}`} direction="up" eager>
      <StatCard title="Total Orders" detail="Selected period" value={value(metrics?.orders, n => Math.round(n).toLocaleString('en-PK'))} icon={PackageSearch} tone="purple" />
      <StatCard title="Total Sales" detail="Selected period" value={value(metrics?.salesPkr, formatDashboardPkr)} icon={ReceiptText} tone="blue" />
      <StatCard title="Average Order" detail="Per saved sale" value={value(metrics?.averageOrderPkr, formatDashboardPkr)} icon={ShoppingCart} tone="orange" />
      <StatCard title="Current Stock" detail="Current regional balance" value={value(metrics?.stockKg, n => `${n.toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`)} icon={Boxes} tone="green" />
    </RevealOnScroll>
    <RegionalDashboardSummary from={dateRange.startDate} to={dateRange.endDate} regionId={dashboardRegionId} onRegionChange={setDashboardRegionId} />
    <CashPanel businessDate={dateRange.endDate} />
    <CollectionsPanel />
    <RevealOnScroll className="dashboard-grid top-grid" direction="up" delayMs={60}>{data ? <SalesOverview daily={data.daily} totalSales={data.metrics.salesPkr} /> : <Panel className="sales-panel"><h2>Total Sales</h2><div className={`dashboard-chart-placeholder ${dashboard.isPending ? 'is-loading' : ''}`}>{dashboard.isPending ? <LoadingSpinner size="lg" label="Loading business data..." showLabel /> : 'Sales chart unavailable. Use Retry above.'}</div></Panel>}<TeaSales query={topProducts} dateRange={dateRange} regionId={dashboardRegionId} /></RevealOnScroll>
    {data && <>
      <RevealOnScroll className="dashboard-grid operations-grid" direction="right" delayMs={80}><CategoryStatistics categories={categories} /><ActiveOrders sales={data.recentSales} /></RevealOnScroll>
      <RevealOnScroll className="dashboard-reveal-panel" direction="left" delayMs={90}><SalesPerformance khata={data.khata} creditSalesPkr={data.metrics.creditSalesPkr} /></RevealOnScroll>
    </>}
  </PageContainer>
}

