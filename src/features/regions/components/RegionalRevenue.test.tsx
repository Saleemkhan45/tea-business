import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ query: {} as Record<string, unknown>, filters: {} as Record<string, unknown> }))
vi.mock('../../dashboard/services/dashboard.service', () => ({ useDashboard: (filters: Record<string, unknown>) => { state.filters = filters; return state.query } }))
import { RegionalRevenue } from './RegionalRevenue'

beforeEach(() => { state.query = { isError: false, isFetching: false, refetch: vi.fn() } })
const render = (regionId = '') => renderToStaticMarkup(<RegionalRevenue from="2026-10-24" to="2026-10-24" regionId={regionId} region={regionId ? 'Configured region' : 'All Regions'} />)
it('requests an explicit Monday–Sunday range with the shared region', () => {
  expect(render('507f1f77bcf86cd799439001')).toContain('2026-10-19 to 2026-10-25')
  expect(state.filters).toEqual({ from: '2026-10-19', to: '2026-10-25', regionId: '507f1f77bcf86cd799439001' })
})
it('does not invent zero revenue while loading or on failure', () => {
  expect(render()).not.toContain('PKR 0')
  state.query.isError = true
  expect(render()).toContain('Revenue data couldn&#x27;t be loaded.')
  expect(render()).not.toContain('PKR 0')
})
it('sums displayed buckets and labels previously confirmed data stale', () => {
  state.query = { ...state.query, isError: true, data: { metrics: { orders: 2 }, daily: [{ date: '2026-10-19', salesPkr: 100.25 }, { date: '2026-10-20', salesPkr: 300.5 }] } }
  const html = render()
  expect(html).toContain('PKR 400.75')
  expect(html).toContain('Previously confirmed figures are stale.')
})
it('only confirms an empty period after a successful server response', () => {
  state.query.data = { metrics: { orders: 0 }, daily: [{ date: '2026-10-19', salesPkr: 0 }] }
  expect(render()).toContain('No sales recorded for this period.')
  expect(render()).toContain('PKR 0')
})
