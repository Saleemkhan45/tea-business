import { getPakistanBusinessDate, shiftBusinessDate } from '../../business/utils/date'

export type RegionPeriod = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'
export function regionDateRange(period: RegionPeriod, today = getPakistanBusinessDate()) {
  const first = `${today.slice(0, 7)}-01`
  if (period === 'today') return { from: today, to: today }
  if (period === 'yesterday') { const day = shiftBusinessDate(today, -1); return { from: day, to: day } }
  if (period === 'last7' || period === 'last30') return { from: shiftBusinessDate(today, period === 'last7' ? -6 : -29), to: today }
  if (period === 'thisMonth') return { from: first, to: today }
  if (period === 'lastMonth') { const last = shiftBusinessDate(first, -1); return { from: `${last.slice(0, 7)}-01`, to: last } }
  return { from: '', to: '' }
}
