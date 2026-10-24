vi.mock('../auth/auth.store', () => ({ useAuthStore: (selector: (state: any) => unknown) => selector({ session: null }) }))
import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ query: vi.fn(), request: vi.fn() }))
vi.mock('@tanstack/react-query', () => ({ useQuery: h.query }))
vi.mock('./regionalInventory.api', async original => ({ ...await original<typeof import('./regionalInventory.api')>(), regionalRequest: h.request }))
import { useRegionalOverview, useRegionReport } from './regionalReports.api'

beforeEach(() => vi.clearAllMocks())

it('does not fetch the heavy region history until the user opens details', () => {
  useRegionReport('region', '2026-10-01', '2026-10-19', '', false)
  const deferred = h.query.mock.lastCall?.[0]
  expect(deferred.enabled).toBe(false)
  useRegionReport('region', '2026-10-01', '2026-10-19', '', true)
  const opened = h.query.mock.lastCall?.[0]
  expect(opened.enabled).toBe(true)
  expect(opened.queryKey).toEqual(deferred.queryKey)
  useRegionReport('', '2026-10-01', '2026-10-19', '', true)
  expect(h.query.mock.lastCall?.[0].enabled).toBe(false)
})

it('forwards cancellation for regional overview reads without changing date scope', async () => {
  const signal = new AbortController().signal
  h.request.mockResolvedValue({ regions: [] })
  useRegionalOverview('2026-10-01', '2026-10-19')
  const options = h.query.mock.lastCall?.[0]
  expect(await options.queryFn({ signal })).toEqual([])
  expect(h.request).toHaveBeenCalledWith('/overview?from=2026-10-01&to=2026-10-19', undefined, 'GET', signal)
})
