import { describe, expect, it } from 'vitest'
import { revenueDate, revenueRange } from './revenuePeriod'

describe('regional revenue business-date periods', () => {
  it('keeps the selected daily business date', () => {
    expect(revenueRange('2026-10-24', 'Daily')).toEqual({ from: '2026-10-24', to: '2026-10-24' })
  })
  it.each(['2026-10-19', '2026-10-24', '2026-10-25'])('uses Monday through Sunday for %s', anchor => {
    expect(revenueRange(anchor, 'Weekly')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })
  it('crosses the year boundary without changing weekday attribution', () => {
    expect(revenueRange('2027-01-01', 'Weekly')).toEqual({ from: '2026-12-28', to: '2027-01-03' })
    expect(revenueDate('2026-12-28', true)).toBe('Mon')
    expect(revenueDate('2027-01-03', true)).toBe('Sun')
  })
  it.each([['2024-02-12', '2024-02-29'], ['2026-02-28', '2026-02-28'], ['2026-12-31', '2026-12-31']])('uses the full calendar month for %s', (anchor, to) => {
    expect(revenueRange(anchor, 'Monthly')).toEqual({ from: anchor.slice(0, 7) + '-01', to })
  })
})
