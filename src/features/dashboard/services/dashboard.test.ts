import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
const auth = vi.hoisted(() => ({ authenticatedFetch: vi.fn(), API_BASE_URL: '/api/v1' }))
vi.mock('../../auth/auth.api', () => auth)
import { DashboardApiError, dashboardSchema, getDashboardData } from './dashboard.service'
import { formatDashboardPkr, getSalesChartGrouping, groupRevenue } from '../components/SalesOverview'
const payload = { from: '2026-10-17', to: '2026-10-18', regionId: null, metrics: { orders: 2, salesPkr: 301, averageOrderPkr: 150.5, stockKg: .125, creditSalesPkr: 201 }, daily: [{ date: '2026-10-17', salesPkr: 100 }, { date: '2026-10-18', salesPkr: 201 }], categories: [], recentSales: [], khata: { outstandingPkr: 0, customers: 0, paymentsTodayPkr: 0, today: '2026-10-18' } }
const filters = { from: payload.from, to: payload.to }
beforeEach(() => vi.clearAllMocks())
describe('dashboard transport and numeric presentation offline', () => {
  it('uses protected API and passes cancellation to avoid obsolete work', async () => {
    const signal = new AbortController().signal
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify(payload)))
    expect(await getDashboardData({ ...filters, regionId: 'region' }, signal)).toEqual(payload)
    expect(auth.authenticatedFetch).toHaveBeenCalledWith('/api/v1/sales/dashboard?from=2026-10-17&to=2026-10-18&regionId=region', { signal })
  })
  it('surfaces failed requests and malformed numeric responses', async () => {
    auth.authenticatedFetch.mockResolvedValue(new Response('{}', { status: 503 }))
    await expect(getDashboardData(filters)).rejects.toThrow('database is temporarily unavailable')
    expect(dashboardSchema.safeParse({ ...payload, metrics: { ...payload.metrics, salesPkr: 'demo' } }).success).toBe(false)
  })
  it('identifies the older router saleId rejection without exposing server diagnostics', async () => {
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Private diagnostic', issues: [{ path: 'saleId', message: 'Invalid ID.' }] }), { status: 400 }))
    await expect(getDashboardData(filters)).rejects.toMatchObject({ name: 'DashboardApiError', status: 400, message: 'The running API does not recognize the dashboard route. Restart the backend with the current code, then retry.' })
  })
  it('keeps query validation distinct from server failure and allows a successful retry', async () => {
    auth.authenticatedFetch.mockResolvedValueOnce(new Response(JSON.stringify({ issues: [{ path: 'from', message: 'Private text' }] }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
    await expect(getDashboardData(filters)).rejects.toMatchObject({ status: 400, message: 'Dashboard request rejected (HTTP 400): check from. Please retry after correcting the request.' })
    expect(await getDashboardData(filters)).toEqual(payload)
  })
  it('omits the optional all-regions parameter and accepts actual zero totals', async () => {
    const zero = { ...payload, metrics: { orders: 0, salesPkr: 0, averageOrderPkr: 0, stockKg: 0, creditSalesPkr: 0 }, daily: [{ date: '2026-10-18', salesPkr: 0 }] }
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify(zero)))
    expect(await getDashboardData({ from: '2026-10-18', to: '2026-10-18', regionId: '' })).toEqual(zero)
    expect(auth.authenticatedFetch.mock.lastCall?.[0]).toBe('/api/v1/sales/dashboard?from=2026-10-18&to=2026-10-18')
  })
  it('distinguishes an HTTP 200 incompatible body from an HTTP 400 request rejection', async () => {
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ ...payload, metrics: { ...payload.metrics, salesPkr: null } })))
    await expect(getDashboardData(filters)).rejects.toBeInstanceOf(DashboardApiError)
    await expect(getDashboardData(filters)).rejects.toMatchObject({ status: 502 })
  })
  it('groups actual daily values without redistributing totals or inventing hours', () => {
    expect(groupRevenue(payload.daily, 'Daily')).toEqual([{ label: '2026-10-17', salesPkr: 100 }, { label: '2026-10-18', salesPkr: 201 }])
    expect(groupRevenue(payload.daily, 'Weekly')).toEqual([{ label: '2026-10-12', salesPkr: 301 }])
    expect(groupRevenue(payload.daily, 'Monthly')).toEqual([{ label: '2026-10', salesPkr: 301 }])
    expect(groupRevenue([], 'Daily')).toEqual([])
    expect(formatDashboardPkr(150.5)).toBe('PKR 150.5')
    expect(formatDashboardPkr(1250000)).toBe('PKR 1,250,000')
  })
  it('never exposes a late old-filter response through a newer observer', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let resolveOld!: (value: string) => void
    const old = new Promise<string>(resolve => { resolveOld = resolve })
    const observer = new QueryObserver(client, { queryKey: ['regional', 'dashboard', filters] as readonly unknown[], queryFn: () => old })
    const unsubscribe = observer.subscribe(() => {})
    observer.setOptions({ queryKey: ['regional', 'dashboard', { ...filters, regionId: 'new' }], queryFn: async () => 'new scope' })
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe('new scope'))
    resolveOld('old scope')
    await old; await Promise.resolve()
    expect(observer.getCurrentResult().data).toBe('new scope')
    unsubscribe(); client.clear()
  })
  it('bounds long-range chart bars without changing summed sales', () => {
    expect(getSalesChartGrouping(31, 'Daily')).toBe('Daily')
    expect(getSalesChartGrouping(93, 'Daily')).toBe('Weekly')
    expect(getSalesChartGrouping(366, 'Daily')).toBe('Monthly')
    expect(getSalesChartGrouping(3660, 'Monthly')).toBe('Yearly')
    const daily = Array.from({ length: 366 }, (_, index) => ({ date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10), salesPkr: index }))
    const buckets = groupRevenue(daily, getSalesChartGrouping(daily.length, 'Daily'))
    expect(buckets).toHaveLength(12)
    expect(buckets.reduce((sum, row) => sum + row.salesPkr, 0)).toBe(daily.reduce((sum, row) => sum + row.salesPkr, 0))
  })
})


