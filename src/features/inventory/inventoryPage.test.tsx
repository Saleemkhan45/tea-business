import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({ isPending: false, isFetching: false, isError: false, error: new Error('Offline API failure'), refetch: vi.fn(), data: [
  { id: 's1', itemId: 'p1', regionId: 'r1', regionName: 'Islamabad', name: 'Green Tea Classic', teaType: 'Green Tea', availableKg: 500, sellingPrice: 1500, status: 'available' as const, updatedAt: '2026-10-14T08:00:00.000Z' },
  { id: 's2', itemId: 'p1', regionId: 'r2', regionName: 'Peshawar', name: 'Green Tea Classic', teaType: 'Green Tea', availableKg: 350, sellingPrice: null, status: 'available' as const, updatedAt: '2026-10-14T08:00:00.000Z' },
] }))
vi.mock('../regions/regionalInventory.api', async importOriginal => ({ ...await importOriginal<object>(), useRegionalInventory: () => query, useRegions: () => ({ data: [] }) }))
import { InventoryPage } from '../../pages/InventoryPage'
import { filterRegionalInventory } from '../regions/regionalInventory.api'
beforeEach(() => { query.isPending = false; query.isError = false })
describe('regional inventory page', () => {
  it('renders independent regional balances for a shared product without fabricated fields', () => {
    const html = renderToStaticMarkup(<InventoryPage />)
    expect(html).toContain('Islamabad'); expect(html).toContain('Peshawar')
    expect(html).toContain('500 kg'); expect(html).toContain('350 kg'); expect(html).toContain('PKR 1,500')
    expect(html).not.toContain('Reserved Stock'); expect(html).not.toContain('Average Cost')
  })
  it('filters by name, region and availability', () => {
    expect(filterRegionalInventory(query.data, ' green ', 'r1', 'available')).toEqual([query.data[0]])
    expect(filterRegionalInventory(query.data, 'unknown', '', '')).toEqual([])
    expect(filterRegionalInventory(query.data, '', '', 'out_of_stock')).toEqual([])
  })
  it('renders API errors and retry', () => {
    query.isError = true
    const html = renderToStaticMarkup(<InventoryPage />)
    expect(html).toContain('Inventory unavailable'); expect(html).toContain('Offline API failure'); expect(html).toContain('Retry')
  })
  it('renders loading state', () => {
    query.isPending = true
    expect(renderToStaticMarkup(<InventoryPage />)).toContain('Loading regional inventory')
  })
  it('renders clear empty inventory without inventing stock', () => {
    const original = query.data; query.data = []
    const html = renderToStaticMarkup(<InventoryPage />)
    expect(html).toContain('No regional inventory found'); expect(html).toContain('record genuine stock')
    query.data = original
  })
})
