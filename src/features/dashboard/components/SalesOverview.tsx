import { useMemo, useState } from 'react'
import { LazyAnalyticsChart } from '../../../components/shared/LazyAnalyticsChart'
import { Panel, SelectMenu } from '../../../components/shared'
import type { LiveDashboard } from '../services/dashboard.service'
import { formatDashboardPkr } from '../formatters'
export { formatDashboardPkr } from '../formatters'
export function getSalesChartGrouping(days: number, period: string) {
  if (days > 1095 && period !== 'Yearly') return 'Yearly'
  if (days > 93 && (period === 'Daily' || period === 'Weekly')) return 'Monthly'
  if (days > 31 && period === 'Daily') return 'Weekly'
  return period
}
export function groupRevenue(daily: LiveDashboard['daily'], period: string) {
  const groups = new Map<string, number>()
  for (const row of daily) {
    const date = new Date(`${row.date}T00:00:00Z`)
    if (period === 'Weekly') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
    const label = period === 'Monthly' ? row.date.slice(0, 7) : period === 'Yearly' ? row.date.slice(0, 4) : date.toISOString().slice(0, 10)
    groups.set(label, (groups.get(label) ?? 0) + row.salesPkr)
  }
  return [...groups].map(([label, salesPkr]) => ({ label, salesPkr }))
}
export function SalesOverview({ daily, totalSales }: { daily: LiveDashboard['daily']; totalSales: number }) {
  const [period, setPeriod] = useState('Daily')
  const grouping = getSalesChartGrouping(daily.length, period)
  const points = useMemo(() => groupRevenue(daily, grouping), [daily, grouping])
  return <Panel className="sales-panel"><div className="panel-heading"><h2>Total Sales</h2><SelectMenu value={period} options={['Daily', 'Weekly', 'Monthly', 'Yearly'].map(value => ({ value, label: value }))} onChange={setPeriod} ariaLabel="Sales chart grouping" /></div>
    <div className="revenue-summary"><strong>{formatDashboardPkr(totalSales)}</strong></div><p>Selected period · saved sales value (PKR)</p>
    {totalSales === 0 && <p role="status">No sales value recorded for this period.</p>}
    {grouping !== period && <p className="chart-note">Grouped {grouping.toLowerCase()} for readability; the selected period and sales total are unchanged.</p>}
    <div className="dashboard-chart" role="img" aria-label={`${grouping} sales in PKR. Selected-period total ${formatDashboardPkr(totalSales)}.`}><LazyAnalyticsChart points={points.map(point => ({ label: point.label, value: point.salesPkr }))} currency name="Sales" /></div>
    <details className="sales-chart-values"><summary>View sales figures</summary><ul>{points.map(point => <li key={point.label}>{point.label}: {formatDashboardPkr(point.salesPkr)}</li>)}</ul></details>
  </Panel>
}

