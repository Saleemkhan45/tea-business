import { describe, expect, it } from 'vitest'
import { purchaseFormSchema, purchasePreview } from './purchaseForm'

const input = { supplier: '507f1f77bcf86cd799439001', item: '507f1f77bcf86cd799439002', receivingRegion: '507f1f77bcf86cd799439003', businessDate: '2026-10-15', quantityKg: 200, unitCost: 600, taxAmount: 1000, shippingAmount: 500, discountAmount: 250, status: 'received', reference: '', notes: '' }
describe('regional purchase form validation and preview', () => {
  it('requires real supplier, assigned product, receiving region and a valid date', () => {
    expect(purchaseFormSchema.safeParse(input).success).toBe(true)
    for (const change of [{ supplier: '' }, { receivingRegion: '' }, { item: 'Green Tea' }, { quantityKg: -1 }, { quantityKg: 0.0001 }, { unitCost: 0.5 }, { businessDate: '2026-02-30' }]) expect(purchaseFormSchema.safeParse({ ...input, ...change }).success).toBe(false)
  })
  it('calculates exact whole-PKR totals and rejects fractional or unsafe totals', () => {
    expect(purchasePreview(input)).toBe(121250)
    expect(purchasePreview({ ...input, quantityKg: 0.001, unitCost: 1 })).toBeUndefined()
    expect(purchasePreview({ ...input, discountAmount: 999999 })).toBeUndefined()
    expect(purchasePreview({ ...input, unitCost: Number.MAX_SAFE_INTEGER })).toBeUndefined()
  })
})
