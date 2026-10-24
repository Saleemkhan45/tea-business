import { describe, expect, it } from 'vitest'
import type { SaleStockItem } from './types/salesApi'
import { inventoryCatalogMessage, inventoryMatchesSearch, inventorySummary, saleInventoryOptions } from './saleInventory'

const green: SaleStockItem = {
  id: '507f1f77bcf86cd799439012',
  name: 'Green Tea Classic',
  teaType: 'green',
  availableKg: 150,
  sellingPrice: 800,
  lowStockThreshold: 20,
  updatedAt: '2026-10-15T08:00:00.000Z',
}

describe('sale inventory catalog presentation', () => {
  it('searches real catalog items by product name or tea type', () => {
    expect(inventoryMatchesSearch(green, 'tea classic')).toBe(true)
    expect(inventoryMatchesSearch(green, 'GREEN')).toBe(true)
    expect(inventoryMatchesSearch(green, 'black')).toBe(false)
  })

  it('maps stable item IDs, stock and configured price into selectable options', () => {
    const options = saleInventoryOptions([green], '', '')
    expect(options[1]).toMatchObject({ value: green.id, disabled: false })
    expect(options[1].label).toContain('Green Tea Classic')
    expect(options[1].label).toContain('150 kg')
    expect(options[1].label).toContain('PKR 800/kg')
  })

  it('keeps the selected product visible during search and disables zero-stock products', () => {
    const empty = { ...green, id: '507f1f77bcf86cd799439013', name: 'Black Tea Empty', teaType: 'black' as const, availableKg: 0 }
    const options = saleInventoryOptions([green, empty], 'no match', empty.id)
    expect(options).toHaveLength(2)
    expect(options[1]).toMatchObject({ value: empty.id, disabled: true })
    expect(options[1].label).toContain('Out of stock')
  })

  it('marks missing prices for the supported manual price flow', () => {
    const options = saleInventoryOptions([{ ...green, sellingPrice: null }], '', '')
    expect(options[1].label).toContain('Price not set')
  })

  it('distinguishes no records, inactive-only, out-of-stock and search-empty states', () => {
    expect(inventoryCatalogMessage([], { totalItems: 0, activeItems: 0, inactiveItems: 0, sellableItems: 0, outOfStockItems: 0 }, '')).toBe('No inventory products have been added yet.')
    expect(inventoryCatalogMessage([], { totalItems: 2, activeItems: 0, inactiveItems: 2, sellableItems: 0, outOfStockItems: 0 }, '')).toBe('No active products available for sale.')
    expect(inventoryCatalogMessage([{ ...green, availableKg: 0 }], undefined, '')).toBe('All active products are currently out of stock.')
    expect(inventoryCatalogMessage([green], undefined, 'black')).toBe('No products match your search.')
    expect(inventoryCatalogMessage([green], undefined, '')).toBeUndefined()
  })

  it('derives safe summary counts for older compatible responses', () => {
    expect(inventorySummary([green, { ...green, id: '507f1f77bcf86cd799439013', availableKg: 0 }])).toEqual({
      totalItems: 2, activeItems: 2, inactiveItems: 0, sellableItems: 1, outOfStockItems: 1,
    })
  })
})
