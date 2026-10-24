import { describe, expect, it } from 'vitest'
import { normalizeSupplierOfferings } from './supplierOfferings'

describe('manual supplier offering validation', () => {
  it('normalizes whitespace and permits no manual offerings', () => {
    expect(normalizeSupplierOfferings([' Green   Tea ', 'Premium Blend'])).toMatchObject({ success: true, data: ['Green Tea', 'Premium Blend'] })
    expect(normalizeSupplierOfferings([' '])).toMatchObject({ success: true, data: [] })
    expect(normalizeSupplierOfferings([])).toMatchObject({ success: true, data: [] })
  })
  it('rejects duplicate names, partial blank rows and excessive lengths', () => {
    for (const rows of [['Green Tea', ' green   tea '], ['Tea', ' '], ['x'.repeat(161)], Array(101).fill('Tea')]) {
      expect(normalizeSupplierOfferings(rows).success).toBe(false)
    }
  })
})
