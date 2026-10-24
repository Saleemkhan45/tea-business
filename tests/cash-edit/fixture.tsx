// Offline fixture only. All business requests terminate in this in-memory fetch.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../src/features/auth/auth.store'
import { CashBookPage } from '../../src/features/cashbook/CashBookPage'
import { CashPanel } from '../../src/features/cashbook/CashPanel'
import { day } from '../../src/features/cashbook/testFixtures'
import { getPakistanBusinessDate } from '../../src/business/utils/date'
import '../../src/style.css'
import '../../src/audit.css'

const today = getPakistanBusinessDate()
const storageKey = 'offline-cash-edit-record'
const initial = { ...day, businessDate: today, shopCashAmount: 20000, bossAddedAmount: 4000, totalCollected: 24000, revision: 0, status: 'active' }
window.cashFixture = { record: JSON.parse(sessionStorage.getItem(storageKey) || 'null') || initial, calls: [], audits: [], status: 200, delay: 0 }
const f = window.cashFixture
useAuthStore.setState({ status: 'authenticated', session: { user: { id: day.enteredBy._id, shopId: 'offline-shop', name: 'Offline Owner', role: 'owner' }, csrfToken: 'offline-csrf', expiresAt: '2099-01-01T00:00:00Z' } })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
window.fetch = async (input, init = {}) => {
  const url = new URL(String(input)), path = url.pathname.split('/cashbook')[1]
  if (path === undefined) throw new Error('Unexpected network access blocked by offline fixture.')
  const method = init.method || 'GET', body = init.body ? JSON.parse(String(init.body)) : null
  f.calls.push({ path, method, body, csrf: new Headers(init.headers).get('X-CSRF-Token') })
  if (method === 'PATCH') {
    await new Promise(resolve => setTimeout(resolve, f.delay))
    if (f.status !== 200) return json({ message: f.status === 409 ? 'This day was corrected by another operator. Reload the saved record before correcting it.' : f.status === 404 ? 'Route not found.' : `Offline test HTTP ${f.status}` }, f.status)
    if (body.expectedRevision !== f.record.revision) return json({ message: 'This day was corrected by another operator. Reload the saved record before correcting it.' }, 409)
    const previous = structuredClone(f.record)
    f.record = { ...f.record, ...body, totalCollected: body.shopCashAmount + body.bossAddedAmount, revision: f.record.revision + 1 }
    f.audits.push({ previous, next: structuredClone(f.record), reason: body.reason })
    sessionStorage.setItem(storageKey, JSON.stringify(f.record))
    return json({ record: f.record, postedRevision: f.record.revision, replayed: false })
  }
  if (method !== 'GET') throw new Error('Unexpected write blocked by offline fixture.')
  if (path === '/status') return json({ ready: true, mode: 'manual_daily', today })
  if (path === '/overview') return json({ today: { date: today, record: f.record }, yesterday: { date: today, record: null } })
  if (path.startsWith('/records/by-date/')) return json({ date: today, record: f.record })
  if (path === '/records') return json({ rows: [f.record], from: today.slice(0, 7) + '-01', to: today, page: 1, limit: 20, total: 1, summary: { shopCashAmount: f.record.shopCashAmount, bossAddedAmount: f.record.bossAddedAmount, totalCollected: f.record.totalCollected, recordedDays: 1, averageDailyCollection: f.record.totalCollected } })
  if (path.startsWith('/records/')) return f.failDetails ? json({ message: 'Offline reload failed' }, 500) : json({ record: f.record, audit: [], page: 1, limit: 20, total: f.audits.length })
  throw new Error('Unexpected offline route: ' + path)
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
window.cashFixture.client = client
createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><MemoryRouter><CashPanel /><CashBookPage /></MemoryRouter></QueryClientProvider>)
