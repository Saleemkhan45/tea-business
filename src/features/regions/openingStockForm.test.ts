import { describe, expect, it } from 'vitest'
import { newOpeningRow, openingStockDraft, regionalSettingsDraft } from './openingStockForm'

describe('opening stock rows', () => {
  it('keeps independent regional settings and treats blank fields as inheritance', () => {
    const result = openingStockDraft([
      { ...newOpeningRow(), itemId: 'one', price: '850', threshold: '0' },
      { ...newOpeningRow(), itemId: 'two', price: '800', threshold: '50.125' },
    ])
    expect(result.openingProducts).toMatchObject([{ sellingPriceOverride: 850, lowStockThresholdOverride: 0 }, { sellingPriceOverride: 800, lowStockThresholdOverride: 50.125 }])
    expect(regionalSettingsDraft({ price: '', threshold: '' })).toEqual({ sellingPriceOverride: null, lowStockThresholdOverride: null })
  })
  it.each(['0', '-1', '1.5', 'Infinity', 'NaN'])('rejects invalid regional selling price %s', price => {
    expect(() => regionalSettingsDraft({ price, threshold: '' })).toThrow('positive whole PKR')
  })
  it.each(['-1', '0.0001', 'Infinity'])('rejects invalid regional alert quantity %s', threshold => {
    expect(() => regionalSettingsDraft({ price: '', threshold })).toThrow('low stock alert')
  })
  it.each([0, 1, 20])('accepts %s different products and sums in integer grams', count => {
    const rows = Array.from({ length: count }, (_, index) => ({ ...newOpeningRow(), itemId: `item-${index}`, quantity: '0.001' }))
    expect(openingStockDraft(rows)).toMatchObject({ productCount: count, totalKg: count / 1000 })
  })
  it('assigns zero without creating a positive quantity', () => {
    expect(openingStockDraft([{ ...newOpeningRow(), itemId: 'item' }]).openingProducts).toEqual([{ itemId: 'item', quantityKg: 0 }])
  })
  it.each(['', '-1', 'NaN', 'Infinity', '0.0001'])('rejects invalid quantity %s', quantity => {
    expect(() => openingStockDraft([{ ...newOpeningRow(), itemId: 'item', quantity }])).toThrow('quantity')
  })
  it('rejects duplicates, incomplete products and more than 20 rows', () => {
    const row = { ...newOpeningRow(), itemId: 'item', quantity: '2' }
    expect(() => openingStockDraft([row, { ...row, key: 'another' }])).toThrow('only once')
    expect(() => openingStockDraft([newOpeningRow()])).toThrow('Choose')
    expect(() => openingStockDraft(Array(21).fill(row))).toThrow('20')
  })
})
