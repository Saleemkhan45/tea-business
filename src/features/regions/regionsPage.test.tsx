import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const data = vi.hoisted(() => ({ role: 'admin', error: false }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: (state: object) => unknown) => select({ session: { user: { role: data.role } } }) }))
vi.mock('./regionalInventory.api', () => ({
  useRegions: () => ({ data: [{ _id: 'r1', name: 'Islamabad', status: 'active' }, { _id: 'r2', name: 'Peshawar', status: 'active' }], isError: data.error, error: new Error('Offline'), refetch: vi.fn() }),
  useProducts: () => ({ data: [], refetch: vi.fn() }),
  useRegionalInventory: () => ({ data: [], refetch: vi.fn() }),
  useRegionHistory: () => ({ data: { operations: [], sales: [] }, refetch: vi.fn() }),
  regionalRequest: vi.fn(),
}))
vi.mock('./regionalReports.api', () => ({
  useRegionalOverview: () => ({ data: [{ _id: 'r1', name: 'Islamabad', status: 'active', stockKg: 4, lowStockProducts: 0, salesPkr: 1000, orders: 1 }, { _id: 'r2', name: 'Peshawar', status: 'active', stockKg: 3, lowStockProducts: 1, salesPkr: 500, orders: 1 }], isPending: false, isError: data.error, error: new Error('Offline'), refetch: vi.fn() }),
  useRegionReport: () => ({ isPending: false, isError: false, data: { region: { _id: 'r1', name: 'Islamabad', status: 'active' }, summary: { stockKg: 4, purchasedKg: 5, quantityKg: 1, salesPkr: 1000, orders: 1, paymentsPkr: 300, creditSalesPkr: 1000, cashSalesPkr: 0, lowStockProducts: 0, accountingNote: 'Standalone payments are not allocated to regions.' }, inventory: [], sales: [], purchases: [], movements: [], products: [], daily: [], salespeople: [] }, refetch: vi.fn() }),
}))
import { RegionsPage } from '../../pages/RegionsPage'
const render = (route = '/regions') => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[route]}><RegionsPage /></MemoryRouter></QueryClientProvider>)
beforeEach(() => { data.role = 'admin'; data.error = false })
describe('live Regions page offline rendering', () => {
  it('renders backend regions and authorized management forms without mock performance metrics', () => {
    const html = render()
    expect(html).toContain('Islamabad'); expect(html).toContain('Peshawar')
    expect(html).toContain('Add Region'); expect(html).toContain('Catalog Product')
    expect(html).not.toContain('Live total across all regions'); expect(html).not.toContain('Performance')
  })
  it('hides stock and catalog management from staff', () => {
    data.role = 'staff'
    expect(render()).not.toContain('Catalog Product')
  })
  it('shows an explicit API error and retry control', () => {
    data.error = true
    const html = render()
    expect(html).toContain('Regions unavailable'); expect(html).toContain('Retry')
  })
  it('opens region details with historical tabs and server totals without allocating customer payments', () => {
    const html = render('/regions?region=r1')
    for (const label of ['Region Details', 'Inventory', 'Purchases', 'Sales History', 'Stock Movements', 'Region Settings', '4 kg', 'PKR 1,000']) expect(html).toContain(label)
    expect(html).toContain('Standalone payments are not allocated to regions.')
  })
})
