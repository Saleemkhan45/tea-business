import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ empty: false, tabError: false }))
const stats = { count: 2, quantityKg: 30, valuePkr: 30000, invoicedPkr: 30000, paymentsPkr: 10000, outstandingPkr: 20000, unknownPayableCount: 1, lastPurchase: '2026-10-22' }
vi.mock('./supplier.api', () => ({ useSupplier: () => ({ data: { supplier: { _id: 'supplier', name: 'API supplier', status: 'active', phone: '03001234567', contactPerson: 'Contact', regions: ['region'], products: ['product'], productOfferings: ['Special blend'], notes: 'Saved profile note' }, stats, currentStats: stats }, isFetching: false }) }))
vi.mock('./supplierProfile.api', () => ({ useSupplierHistory: () => ({ data: { rows: fixture.empty ? [] : [{ _id: 'record', purchaseId: 'invoice', reference: 'INV-100', businessDate: '2026-10-22', productName: 'Saved product', quantityKg: 10, totalAmount: 10000, status: 'received', invoiceStatus: 'voided', date: '2026-10-23', amountPkr: 5000, method: 'cash', operatorName: 'Saved operator', quantityGrams: 10000, type: 'purchase_reversal', action: 'edit', revision: 1, changes: [{ field: 'phone', previous: '1234567', next: '7654321' }] }], total: fixture.empty ? 0 : 1, page: 1, limit: 10, products: [], regions: [], trend: [] }, isFetching: false, isError: fixture.tabError, error: new Error('History unavailable'), refetch: vi.fn() }) }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: 'region', name: 'Peshawar' }] }), useProducts: () => ({ data: [{ _id: 'product', name: 'Catalog product' }] }) }))
import { SupplierDetailsDrawer } from './components/SupplierDetailsDrawer'
import { SupplierProfileHistory } from './components/SupplierProfileHistory'
const render = (element: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
beforeEach(() => { fixture.empty = false; fixture.tabError = false })
describe('supplier profile presentation, supplied offline API records', () => {
  it('owns its overlay geometry and renders summary, overview, six tabs and header close/edit', () => {
    const html = render(<SupplierDetailsDrawer id="supplier" from="" to="" canManage purchasesOnly={false} onClose={() => {}} />)
    for (const text of ['supplier-profile-backdrop', 'supplier-profile-dialog', 'API supplier', 'Saved profile note', 'Special blend', 'Catalog product', 'PKR 20,000', 'Close supplier details', 'Edit Supplier', 'Stock Movements', 'Activity &amp; Edit History', 'Analytics']) expect(html).toContain(text)
    expect(html).not.toContain('inventory-drawer')
    expect(html).toContain('unknown payment attribution')
    expect(html.match(/role="tab"/g)).toHaveLength(6)
  })
  it('shows bounded invoice rows and uses the supported Purchases selected-record contract', () => {
    const html = render(<SupplierProfileHistory id="supplier" tab="purchases" from="" to="" onNavigate={() => {}} />)
    expect(html).toContain('Saved product'); expect(html).toContain('INV-100')
    expect(html).toContain('/purchases?record=invoice'); expect(html).toContain('Page 1 of 1')
  })
  it('labels payments on voided invoices without including them in payable totals', () => {
    const html = render(<SupplierProfileHistory id="supplier" tab="payments" from="" to="" onNavigate={() => {}} />)
    expect(html).toContain('PKR 5,000'); expect(html).toContain('Saved operator')
    expect(html).toContain('Voided invoice'); expect(html).toContain('excluded from payables')
  })
  it('shows reversal movements and genuine previous/new audit data separately', () => {
    expect(render(<SupplierProfileHistory id="supplier" tab="movements" from="" to="" onNavigate={() => {}} />)).toContain('Purchase reversal')
    const html = render(<SupplierProfileHistory id="supplier" tab="activity" from="" to="" onNavigate={() => {}} />)
    expect(html).toContain('1234567'); expect(html).toContain('7654321'); expect(html).toContain('Revision')
  })
  it('uses compact empty states instead of inventing history or empty charts', () => {
    fixture.empty = true
    for (const tab of ['purchases', 'payments', 'movements', 'activity', 'analytics'] as const) {
      const html = render(<SupplierProfileHistory id="supplier" tab={tab} from="" to="" onNavigate={() => {}} />)
      expect(html).toContain('supplier-profile-empty'); expect(html).not.toContain('<table')
      expect(html).not.toContain('supplier-analytics-grid')
    }
  })
  it('isolates history failures and allows retrying that tab', () => {
    fixture.tabError = true
    const html = render(<SupplierProfileHistory id="supplier" tab="analytics" from="" to="" onNavigate={() => {}} />)
    expect(html).toContain('History unavailable'); expect(html).toContain('Retry analytics')
  })
})
