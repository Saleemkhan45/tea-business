import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPKR } from '../../business/utils/formatters'

export type AnalyticsBarChartProps = { points: { label: string; value: number }[]; currency?: boolean; name: string }

export default function AnalyticsBarChart({ points, currency = false, name }: AnalyticsBarChartProps) {
  return <ResponsiveContainer width="100%" height="100%" debounce={100}><BarChart data={points} accessibilityLayer>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="label" minTickGap={32} tick={{ fontSize: 11 }} tickFormatter={(label: string) => label.length > 14 ? `${label.slice(0, 12)}...` : label} />
    <YAxis width={50} tick={{ fontSize: 11 }} tickFormatter={value => Number(value).toLocaleString('en-PK', { notation: 'compact' })} />
    <Tooltip formatter={value => currency ? formatPKR(Number(value)) : `${Number(value).toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`} />
    <Bar dataKey="value" name={name} fill="var(--blue)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
  </BarChart></ResponsiveContainer>
}
