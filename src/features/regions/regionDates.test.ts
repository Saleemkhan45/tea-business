import { describe, expect, it } from 'vitest'
import { regionDateRange } from './regionDates'

describe('regional business-date ranges', () => {
  it('uses inclusive 7 and 30 day ranges', () => {
    expect(regionDateRange('last7', '2026-10-15')).toEqual({ from: '2026-10-09', to: '2026-10-15' })
    expect(regionDateRange('last30', '2026-10-15')).toEqual({ from: '2026-09-16', to: '2026-10-15' })
  })
  it('handles month/year boundaries and leap-year February', () => {
    expect(regionDateRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(regionDateRange('lastMonth', '2024-03-01')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(regionDateRange('yesterday', '2026-01-01')).toEqual({ from: '2025-12-31', to: '2025-12-31' })
    expect(regionDateRange('thisMonth', '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' })
  })
})
