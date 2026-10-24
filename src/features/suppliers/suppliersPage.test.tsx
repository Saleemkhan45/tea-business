import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { role: 'admin' } } }) }))
const fixture = vi.hoisted(() => ({ state: 'ready' }))
const stats = { quantityKg: 200, valuePkr: 130000, invoicedPkr: 130000, paymentsPkr: 30000, outstandingPkr: 100000, unknownPayableCount: 0, count: 1, lastPurchase: '2026-10-17' }
vi.mock('./supplier.api', () => ({
  useSuppliers: () => ({ data: fixture.state === 'ready' ? { suppliers: [{ _id: 'supplier', name: 'Actual supplier', contactPerson: 'Contact', phone: '03001234567', regions: ['region'], products: ['product'], status: 'active', stats }], stats } : fixture.state === 'empty' ? { suppliers: [], stats: { ...stats, quantityKg: 0, valuePkr: 0, outstandingPkr: 0 } } : undefined, isPending: fixture.state === 'loading', isError: fixture.state === 'error', error: new Error('API unavailable'), refetch: vi.fn() }),
  useSupplier: () => ({ data: undefined }),
}))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: 'region', name: 'Islamabad' }] }), useProducts: () => ({ data: [{ _id: 'product', name: 'Green Tea', teaType: 'Green' }] }) }))
import { SuppliersPage, supplierPeriod } from '../../pages/SuppliersPage'
const render = () => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><SuppliersPage /></QueryClientProvider>)
beforeEach(() => { fixture.state = 'ready' })
describe('supplier directory presentation (offline)', () => {
  it('renders API records, real totals, filters and accessible row actions', () => {
    const html = render()
    expect(html).toContain('Actual supplier'); expect(html).toContain('Islamabad')
    expect(html).toContain('PKR 130,000'); expect(html).toContain('PKR 100,000')
    expect(html).toContain('Actions for Actual supplier'); expect(html).toContain('Filter suppliers by product')
    expect(html).not.toContain('Mountain Leaf'); expect(html).not.toContain('>24<')
  })
  it('renders loading, empty and API failure with retry controls', () => {
    fixture.state = 'loading'; expect(render()).toContain('Loading suppliers')
    fixture.state = 'empty'; expect(render()).toContain('No suppliers found')
    fixture.state = 'error'; const html = render(); expect(html).toContain('API unavailable'); expect(html).toContain('Retry suppliers')
  })
  it('calculates inclusive business-date presets across month and year boundaries', () => {
    expect(supplierPeriod('today', '2026-10-17')).toEqual({ from: '2026-10-17', to: '2026-10-17' })
    expect(supplierPeriod('week', '2026-01-03')).toEqual({ from: '2025-12-28', to: '2026-01-03' })
    expect(supplierPeriod('month', '2026-10-17')).toEqual({ from: '2026-10-01', to: '2026-10-17' })
    expect(supplierPeriod('lastMonth', '2026-01-17')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(supplierPeriod('custom')).toEqual({ from: '', to: '' })
  })
})


