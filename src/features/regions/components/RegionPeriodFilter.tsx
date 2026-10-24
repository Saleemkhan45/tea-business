import { useState } from 'react'
import { regionDateRange, type RegionPeriod } from '../regionDates'

export function RegionPeriodFilter({ from, to, onChange }: { from: string; to: string; onChange: (range: { from: string; to: string }) => void }) {
  const [period, setPeriod] = useState<RegionPeriod>(() => {
    const presets: RegionPeriod[] = ['all', 'today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth']
    return presets.find(value => { const range = regionDateRange(value); return range.from === from && range.to === to }) ?? 'custom'
  })
  return <div className="regional-date-filter"><label>Reporting Period<select value={period} onChange={event => { const value = event.target.value as RegionPeriod; setPeriod(value); if (value !== 'custom') onChange(regionDateRange(value)) }}>
    <option value="all">All time</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 Days</option><option value="last30">Last 30 Days</option><option value="thisMonth">This Month</option><option value="lastMonth">Last Month</option><option value="custom">Custom Date Range</option>
  </select></label><label>Start Date<input type="date" value={from} onChange={event => { setPeriod('custom'); onChange({ from: event.target.value, to }) }} /></label><label>End Date<input type="date" value={to} min={from || undefined} onChange={event => { setPeriod('custom'); onChange({ from, to: event.target.value }) }} /></label>{from && to && from > to && <small role="alert">End date must follow start date.</small>}</div>
}
