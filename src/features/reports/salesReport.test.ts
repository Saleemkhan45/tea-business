import { describe, expect, it } from 'vitest'
import { toSalesReportRecord } from './salesReport'
import { sale } from '../sales/test/fixtures'

describe('persisted sales report adapter', () => {
  it('keeps business salesperson, operator and fulfillment region distinct', () => {
    expect(toSalesReportRecord({ ...sale, salespersonName: 'Ali', enteredByName: 'Admin', customerRegion: 'Customer city', sellingRegionName: 'Islamabad' }))
      .toMatchObject({ soldBy: 'Ali', enteredBy: 'Admin', region: 'Islamabad', grandTotal: sale.totalAmount })
  })
  it('does not invent attribution for legacy sales or turn voided sales into completed sales', () => {
    expect(toSalesReportRecord({ ...sale, status: 'voided' })).toMatchObject({ soldBy: undefined, enteredBy: '-', status: 'Voided' })
    expect(toSalesReportRecord({ ...sale, quantityKg: undefined }).itemsSold).toBeUndefined()
  })
})
