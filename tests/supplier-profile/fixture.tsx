// Offline browser fixtures. Business requests never reach a server or database.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../src/features/auth/auth.store'
import { SuppliersPage } from '../../src/pages/SuppliersPage'
import '../../src/style.css'
import '../../src/audit.css'
import '../../src/theme.css'

const supplierId = '507f1f77bcf86cd799439001', region = '507f1f77bcf86cd799439002', product = '507f1f77bcf86cd799439003'
const stats = { count: 2, quantityKg: 30, valuePkr: 30000, invoicedPkr: 30000, paymentsPkr: 10000, outstandingPkr: 20000, unknownPayableCount: 0, lastPurchase: '2026-10-22' }
window.supplierFixture = { calls: [], error: false, failTab: '', empty: false, delay: 0, stats, audits: [], supplier: { _id: supplierId, name: 'Offline Tea Supplier', phone: '03001234567', alternatePhone: '', contactPerson: 'Offline contact', email: 'offline@example.test', address: 'Offline address', city: 'Peshawar', regions: [region], products: [product], productOfferings: ['Special tea blend'], notes: 'Persisted fixture profile notes', status: 'active', revision: 0, createdAt: '2026-10-01T05:00:00Z', updatedAt: '2026-10-01T05:00:00Z' } }
const f = window.supplierFixture
useAuthStore.setState({ status: 'authenticated', session: { user: { id: '507f1f77bcf86cd799439004', shopId: 'offline-shop', name: 'Offline Owner', role: 'owner' }, csrfToken: 'offline-csrf', expiresAt: '2099-01-01T00:00:00Z' } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
window.fetch = async (input, init = {}) => {
  const u = new URL(String(input)), method = init.method || 'GET', body = init.body ? JSON.parse(String(init.body)) : null
  f.calls.push({ path: u.pathname, params: u.search, method, body })
  if (u.pathname.endsWith('/regional/regions')) return json({ regions: [{ _id: region, name: 'Peshawar', status: 'active' }] })
  if (u.pathname.endsWith('/regional/products')) return json({ products: [{ _id: product, name: 'Green Tea', teaType: 'green', status: 'active' }] })
  if (!u.pathname.includes('/purchases/suppliers')) throw new Error('Unexpected request blocked by offline fixture')
  const zero = { ...stats, count: 0, quantityKg: 0, valuePkr: 0, invoicedPkr: 0, paymentsPkr: 0, outstandingPkr: 0, lastPurchase: null }
  if (method === 'PATCH') {
    await new Promise(resolve => setTimeout(resolve, f.delay))
    if (f.error) return json({ message: 'Offline profile save rejected', code: 'SUPPLIER_VALIDATION_FAILED' }, 400)
    if (body.revision !== f.supplier.revision) return json({ message: 'Supplier changed. Reopen the record before saving again.', code: 'SUPPLIER_EDIT_CONFLICT' }, 409)
    f.audits.push({ _id: 'audit-' + f.supplier.revision, revision: f.supplier.revision + 1, action: 'edit', createdAt: new Date().toISOString(), operatorName: 'Offline Owner', changes: [{ field: 'name', previous: f.supplier.name, next: body.name }] })
    f.supplier = { ...f.supplier, ...body, revision: f.supplier.revision + 1 }
    return json({ supplier: f.supplier })
  }
  if (method !== 'GET') throw new Error('Unexpected write blocked')
  if (u.pathname.endsWith('/profile')) return json({ supplier: f.supplier, stats: f.empty ? zero : u.searchParams.get('from') ? { ...stats, count: 1, quantityKg: 10, valuePkr: 10000 } : stats, currentStats: f.empty ? zero : stats })
  if (u.pathname.endsWith('/history')) {
    const tab = u.searchParams.get('tab'), page = Number(u.searchParams.get('page') || '1')
    if (f.failTab === tab) return json({ message: 'Offline history unavailable' }, 500)
    if (tab === 'analytics') return json(f.empty ? { products: [], regions: [], trend: [] } : { products: [{ name: 'Green Tea', count: 2, quantityKg: 30, valuePkr: 30000 }], regions: [{ name: 'Peshawar', count: 2, quantityKg: 30, valuePkr: 30000 }], trend: [{ name: '2026-10-22', count: 2, quantityKg: 30, valuePkr: 30000 }] })
    const common = { _id: '507f1f77bcf86cd799439005', purchaseId: '507f1f77bcf86cd799439005', reference: 'INV-OFFLINE-01', productName: 'Green Tea', businessDate: '2026-10-22', quantityKg: 10, unitCost: 1000, totalAmount: 10000, regionName: 'Peshawar', status: 'received', invoiceStatus: 'received', operatorName: 'Offline Owner' }
    const rows = f.empty ? [] : tab === 'activity' ? f.audits : tab === 'payments' ? [{ ...common, date: '2026-10-23', amountPkr: 5000, method: 'bank_transfer', paymentReference: 'BANK-REF' }] : tab === 'movements' ? [{ ...common, date: '2026-10-22', quantityGrams: 10000, type: 'purchase_receipt', reason: 'Purchase received' }, { ...common, _id: 'reversal', quantityGrams: 2000, type: 'purchase_reversal', reason: 'Approved reversal' }] : Array.from({ length: page === 1 ? 10 : 1 }, (_, i) => ({ ...common, _id: common._id.slice(0, -2) + String(i + page * 10), reference: 'INV-OFFLINE-' + (i + page * 10) }))
    return json({ rows, total: tab === 'purchases' && !f.empty ? 11 : rows.length, page, limit: 10 })
  }
  return json({ suppliers: [{ ...f.supplier, stats: f.empty ? zero : stats }], stats: f.empty ? zero : stats })
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
f.client = client
function App() { const location = useLocation(); return <><output id="path">{location.pathname + location.search}</output><SuppliersPage /></> }
createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/suppliers']}><App /></MemoryRouter></QueryClientProvider>)
