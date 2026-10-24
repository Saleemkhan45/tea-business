import { lazy, Suspense, useState } from 'react'
import { ChartColumnIncreasing } from 'lucide-react'
import { Button, SelectMenu, QueryFreshness } from '../../../components/shared'
import { useDashboard } from '../../dashboard/services/dashboard.service'
import { formatDashboardPkr } from '../../dashboard/formatters'
import { revenueRange, type RevenuePeriod } from '../revenuePeriod'
import './regional-revenue.css'

const RevenueBars = lazy(() => import('./RevenueBars'))

export function RegionalRevenue({ from, to, regionId, region }: { from: string; to: string; regionId: string; region: string }) {
  const [period, setPeriod] = useState<RevenuePeriod>('Weekly')
  const range = revenueRange(to, period)
  const query = useDashboard({ ...range, regionId: regionId || undefined })
  const data = query.data
  const total = data?.daily.reduce((sum, day) => sum + day.salesPkr, 0)
  return <section className="regional-revenue" aria-label="Regional Sales Revenue">
    <div className="regional-revenue-heading"><h3><ChartColumnIncreasing size={20} aria-hidden="true" />Regional Sales Revenue</h3><SelectMenu value={period} onChange={setPeriod} options={(['Daily', 'Weekly', 'Monthly'] as const).map(value => ({ value, label: value }))} ariaLabel="Revenue period" floating /></div>
    <p className="regional-revenue-range">{region} · {range.from} to {range.to} · Asia/Karachi</p>
    {(range.from !== from || range.to !== to) && <p className="regional-revenue-context">Showing the {period === 'Weekly' ? 'Monday–Sunday week' : period === 'Monthly' ? 'calendar month' : 'business day'} containing Dashboard end date {to}. Dashboard cards retain {from} to {to}.</p>}
    {period === 'Daily' && <p className="regional-revenue-context">Business-date total; sale-hour timestamps are not recorded.</p>}
    <QueryFreshness query={query} label="revenue" onRetry={() => void query.refetch()} />
    {query.isError && <div role="alert">Revenue data couldn't be loaded. {data && 'Previously confirmed figures are stale.'} <Button onClick={() => void query.refetch()}>Retry</Button></div>}
    {!data && !query.isError && <div className="regional-revenue-loading" role="status">Loading revenue…</div>}
    {data && <><div className="regional-revenue-total"><span>Total Revenue (PKR)</span><strong>{formatDashboardPkr(total!)}</strong><small><i aria-hidden="true" />Sales revenue</small></div>
      {data.metrics.orders === 0 && <p role="status">No sales recorded for this period.</p>}
      <div className="regional-revenue-chart"><Suspense fallback={<p role="status">Loading chart…</p>}><RevenueBars daily={data.daily} region={region} period={period} /></Suspense></div>
      <details className="regional-revenue-values"><summary>View daily revenue figures</summary><ul>{data.daily.map(day => <li key={day.date}>{day.date} · {region}: {formatDashboardPkr(day.salesPkr)}</li>)}</ul></details>
    </>}
  </section>
}
