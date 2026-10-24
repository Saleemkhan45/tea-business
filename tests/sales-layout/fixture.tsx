// Isolated layout fixture: real shell/page/hooks; every request intercepted. Writes are forbidden.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '../../src/layouts/MainLayout'
import { SalesPage } from '../../src/pages/SalesPage'
import { useAuthStore } from '../../src/features/auth/auth.store'
import '../../src/style.css'
import '../../src/audit.css'
import '../../src/theme.css'

const date = '2026-10-23'
const sales = Array.from({ length: 12 }, (_, i) => ({ _id: `offline-sale-${i}`, shop: 'offline-shop', customerName: i ? `Customer ${i}` : 'Long Customer Name For Responsive Layout', businessDate: date, teaType: i % 2 ? 'green' : 'black', sellingRegionName: 'North', productName: 'Tea Product', quantityKg: 2, unitPrice: 1000, totalAmount: 2000, amountPaid: i % 2 ? 2000 : 0, status: 'completed', paymentMethod: i % 2 ? 'cash' : 'credit', enteredByName: 'Offline Owner', inventoryMovements: [], editHistory: [], createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` }))
useAuthStore.setState({ status: 'authenticated', session: { user: { id: 'offline-owner', shopId: 'offline-shop', name: 'Offline Owner', role: 'owner', email: 'offline@example.invalid', shopName: 'Offline Shop' }, csrfToken: 'offline-csrf', expiresAt: '2099-01-01T00:00:00.000Z' } })
window.salesFixture = { calls: [], sales }
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input)).pathname
  window.salesFixture.calls.push({ path, method: init.method ?? 'GET' })
  if (init.method && init.method !== 'GET') throw new Error('Writes forbidden in layout fixture')
  let body
  if (path.endsWith('/sales/summary')) body = { summary: { date, salesPkr: 24000, greenKg: 12, blackKg: 12, transactions: 12, cashReceivedPkr: 12000, khataPkr: 12000, outstandingPkr: 12345678 } }
  else if (path.endsWith('/sales/entry-options')) body = { operator: { id: 'offline-owner', name: 'Offline Owner', role: 'owner' }, items: [] }
  else if (path.endsWith('/sales')) body = { sales: window.salesFixture.sales }
  else if (path.endsWith('/regions')) body = { regions: [] }
  else if (path.includes('/notifications')) body = path.includes('unread') ? { count: 0 } : { notifications: [], pagination: { page: 1, pages: 0, total: 0 } }
  else if (path.includes('/products')) body = { products: [] }
  else throw new Error(`Unexpected request blocked: ${path}`)
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
window.salesFixture.client = client
createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/sales']}><Routes><Route element={<MainLayout />}><Route path="*" element={<SalesPage />} /></Route></Routes></MemoryRouter></QueryClientProvider>)
