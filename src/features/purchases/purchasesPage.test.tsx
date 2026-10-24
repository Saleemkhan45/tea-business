import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ role: 'admin' }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { role: fixture.role } } }) }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [], isError: false, isPending: false, refetch: vi.fn() }), useRegionalInventory: vi.fn() }))
vi.mock('./purchase.api', () => ({
  usePurchases: () => ({ data: [
    { _id: 'legacy', businessDate: '2026-10-14', quantityKg: 1, totalAmount: 500, paidAmount: 0, status: 'received' },
    { _id: 'managed', businessDate: '2026-10-15', quantityKg: 2, totalAmount: 1000, paidAmount: 100, status: 'pending', receivingRegion: 'region', regionName: 'Islamabad', productName: 'Green Tea', supplierName: 'Supplier', unitCost: 500, payments: [] },
  ], isPending: false, isError: false, refetch: vi.fn() }),
  useInvalidatePurchases: () => vi.fn(), usePurchaseOptions: vi.fn(), writePurchase: vi.fn(), purchaseRequest: vi.fn(),
}))
import { PurchasesPage } from '../../pages/PurchasesPage'
const render = () => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PurchasesPage /></MemoryRouter></QueryClientProvider>)
beforeEach(() => { fixture.role = 'admin' })
describe('persisted purchase page presentation (offline)', () => {
  it('shows real purchase rows and preserves unknown legacy payment attribution', () => {
    const html = render()
    expect(html).toContain('Islamabad'); expect(html).toContain('Green Tea')
    expect(html).toContain('Legacy payments not recorded')
    expect(html).toContain('Add Purchase'); expect(html).toContain('Receive')
  })
  it('hides purchasing and payment mutations from staff', () => {
    fixture.role = 'staff'
    const html = render()
    expect(html).not.toContain('+ Add Purchase')
    expect(html).not.toContain('Record payment')
    expect(html).not.toContain('>Reverse<')
  })
})
