import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CollectionScheduleCard } from './CollectionScheduleCard'
import { CollectionsPanel } from './CollectionsPanel'
import { getPakistanBusinessDate } from '../../business/utils/date'
import { collectionRequest } from './collections.api'
const auth = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: '/api/v1', authenticatedFetch: auth.fetch }))
function render(element: React.ReactNode, client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })) {
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
describe('collection UI and authenticated API', () => {
  it('renders accessible weekly schedule controls with all weekdays and no default fake amount', () => {
    const client = new QueryClient()
    client.setQueryData(['collections', 'schedule', 'customer'], { schedule: null, nextCollectionDate: null })
    const html = render(<CollectionScheduleCard customerId="customer" />, client)
    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) expect(html).toContain(day)
    expect(html).toContain('<fieldset>')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('Asia/Karachi')
    expect(html).toContain('Reminder notes')
    expect(html).toContain('value=""')
  })
  it('renders saved schedule status, next date and expected amount', () => {
    const client = new QueryClient()
    client.setQueryData(['collections', 'schedule', 'customer'], { schedule: { weekdays: [3, 5], status: 'active', revision: 1, expectedAmount: 2000 }, nextCollectionDate: '2026-10-23' })
    const html = render(<CollectionScheduleCard customerId="customer" />, client)
    expect(html).toContain('Wednesday, Friday')
    expect(html).toContain('2026-10-23')
    expect(html).toContain('2,000')
    expect(html).toContain('Pause')
  })
  it('shows linked customers, receipts and collection statuses without counting expected money as revenue', () => {
    const today = getPakistanBusinessDate()
    const params = new URLSearchParams({ from: today, to: today, page: '1', limit: '10' })
    const client = new QueryClient()
    client.setQueryData(['collections', 'list', params.toString()], { rows: [{ id: 'occurrence', customerId: 'customer', customerName: 'Offline fixture', phone: '123', balance: 19000, scheduledDate: today, expectedAmount: 2000, receivedAmount: 1000, unpaidAmount: 1000, status: 'partial' }], total: 1,
      totals: { expected: 2000, received: 1000, unpaid: 1000, collected: 0, partial: 1, overdue: 0 } })
    const html = render(<CollectionsPanel report />, client)
    expect(html).toContain('/customers/customer')
    expect(html).toContain('Partially Collected')
    expect(html).toContain('Received against these collections')
    expect(html).toContain('Receive Payment')
    expect(html).toContain('Acknowledge follow-up')
  })
  it('uses the existing authenticated request helper for schedule writes', async () => {
    auth.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ schedule: {} }) })
    await collectionRequest('/customer/schedule', { status: 'paused' })
    expect(auth.fetch).toHaveBeenCalledWith('/api/v1/collections/customer/schedule', expect.objectContaining({ method: 'PUT', body: '{"status":"paused"}' }))
  })
  it('preserves actionable errors instead of confirming an uncertain save', async () => {
    auth.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Schedule changed. Reload before saving.' }) })
    await expect(collectionRequest('/customer/schedule', {})).rejects.toThrow('Schedule changed')
  })
})
