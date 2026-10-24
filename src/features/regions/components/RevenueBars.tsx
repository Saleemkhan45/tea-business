import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDashboardPkr } from '../../dashboard/formatters'
import { revenueDate, type RevenuePeriod } from '../revenuePeriod'

export default function RevenueBars({ daily, region, period }: { daily: { date: string; salesPkr: number }[]; region: string; period: RevenuePeriod }) {
  return <ResponsiveContainer width="100%" height="100%" debounce={100}><BarChart data={daily} accessibilityLayer margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
    <CartesianGrid vertical={false} stroke="var(--border, #e2e8f0)" strokeDasharray="3 4" />
    <XAxis dataKey="date" tickFormatter={date => period === 'Weekly' ? revenueDate(date, true) : revenueDate(date)} interval={period === 'Weekly' ? 0 : 'preserveStartEnd'} minTickGap={22} tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} />
    <YAxis width={43} tickFormatter={value => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} />
    <Tooltip cursor={{ fill: 'rgba(59,130,246,.08)' }} content={({ active, payload }) => {
      const row = payload?.[0]?.payload as { date: string; salesPkr: number } | undefined
      return active && row ? <div className="regional-revenue-tooltip"><strong>{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${row.date}T00:00:00Z`))}</strong><span>Region: {region}</span><span>Sales Revenue: <b>{formatDashboardPkr(row.salesPkr)}</b></span></div> : null
    }} />
    <Bar dataKey="salesPkr" name="Sales Revenue (PKR)" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false} />
  </BarChart></ResponsiveContainer>
}
