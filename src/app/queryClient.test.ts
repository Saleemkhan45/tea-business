import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryObserver } from '@tanstack/react-query'
import { createAppQueryClient, readRetryDelay, retryRead } from './queryClient'
import { scopedKey } from '../features/auth/queryScope'
import { refetchFailedReadsAfterRecovery } from '../features/auth/AuthProvider'
import { cashQueryKey, confirmedCashDay } from '../features/cashbook/api'
import { day } from '../features/cashbook/testFixtures'

const user = { id: 'operator-a', shopId: 'shop-a' }
const filters = { from: '2026-10-01', to: '2026-10-22', regionId: 'region-a' }
const key = scopedKey(['regional', 'dashboard', filters], user)
afterEach(() => vi.useRealTimers())

describe('protected in-memory query policies', () => {
  it('deduplicates simultaneous reads and reuses fresh data on return navigation', async () => {
    const client = createAppQueryClient(), request = vi.fn(async () => ({ salesPkr: 10000 }))
    const [first, second] = await Promise.all([client.fetchQuery({ queryKey: key, queryFn: request }), client.fetchQuery({ queryKey: key, queryFn: request })])
    expect(first).toEqual(second); expect(request).toHaveBeenCalledOnce()
    await client.fetchQuery({ queryKey: key, queryFn: request })
    expect(request).toHaveBeenCalledOnce()
    await client.invalidateQueries({ queryKey: ['regional', 'dashboard'] })
    await client.fetchQuery({ queryKey: key, queryFn: request })
    expect(request).toHaveBeenCalledTimes(2)
    client.clear()
  })
  it('preserves old confirmed data during a background fetch and labels its error via query state', async () => {
    const client = createAppQueryClient()
    client.setQueryData(key, { salesPkr: 10000 }, { updatedAt: Date.now() - 31_000 })
    let reject!: (error: Error) => void
    const pending = new Promise<never>((_resolve, fail) => { reject = fail })
    const observer = new QueryObserver(client, { queryKey: key, queryFn: () => pending, retry: false })
    const unsubscribe = observer.subscribe(() => {})
    expect(observer.getCurrentResult()).toMatchObject({ data: { salesPkr: 10000 }, isFetching: true, isPending: false })
    reject(new Error('Fixture backend failure'))
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true))
    expect(observer.getCurrentResult()).toMatchObject({ data: { salesPkr: 10000 }, isFetching: false })
    unsubscribe(); client.clear()
  })
  it('isolates shops, users, regions and date ranges while retaining mutation prefixes', () => {
    const client = createAppQueryClient(); client.setQueryData(key, { salesPkr: 10000 })
    for (const other of [
      scopedKey(['regional', 'dashboard', filters], { ...user, shopId: 'shop-b' }),
      scopedKey(['regional', 'dashboard', filters], { ...user, id: 'operator-b' }),
      scopedKey(['regional', 'dashboard', { ...filters, regionId: 'region-b' }], user),
      scopedKey(['regional', 'dashboard', { ...filters, from: '2026-10-21' }], user),
    ]) expect(client.getQueryData(other)).toBeUndefined()
    expect(client.getQueryCache().findAll({ queryKey: ['regional'] })).toHaveLength(1)
    client.clear()
  })
  it('separates Cash Book cache identity and accepts only consistent acknowledged records', () => {
    expect(cashQueryKey('shop-a', '/overview', 'a')).not.toEqual(cashQueryKey('shop-b', '/overview', 'a'))
    expect(cashQueryKey('shop-a', '/overview', 'a')).not.toEqual(cashQueryKey('shop-a', '/overview', 'b'))
    expect(confirmedCashDay(day)).toBe(true)
    expect(confirmedCashDay({ ...day, totalCollected: 1 })).toBe(false)
    expect(confirmedCashDay({ ...day, revision: -1 })).toBe(false)
    expect(confirmedCashDay(undefined)).toBe(false)
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T18:59:59Z'))
    const before = cashQueryKey('shop-a', '/overview', 'a')
    vi.setSystemTime(new Date('2026-10-22T19:00:00Z'))
    expect(cashQueryKey('shop-a', '/overview', 'a')).not.toEqual(before)
  })
  it('uses bounded read retries without retrying terminal authentication, validation, conflict or cancellation', () => {
    for (const status of [400, 401, 403, 404, 409]) expect(retryRead(0, { status })).toBe(false)
    expect(retryRead(0, { status: 503 })).toBe(true)
    expect(retryRead(1, { status: 503 })).toBe(true)
    expect(retryRead(2, { status: 503 })).toBe(false)
    for (const status of [408, 429]) expect(retryRead(0, { status })).toBe(true)
    expect(retryRead(0, { status: 502, kind: 'invalid-response' })).toBe(false)
    expect(readRetryDelay(0, { retryAfterSeconds: 17 })).toBeGreaterThanOrEqual(17000)
    expect(readRetryDelay(1, {})).toBeGreaterThanOrEqual(1600)
    expect(retryRead(0, new DOMException('Canceled', 'AbortError'))).toBe(false)
    const client = createAppQueryClient()
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
    expect(client.getQueryDefaults(['regional', 'regions']).staleTime).toBe(300000)
    expect(client.getQueryDefaults(key).staleTime).toBe(30000)
    client.clear()
  })
})

it('bounds post-revalidation retries even when session checks work but a widget stays broken', async () => {
  const client = createAppQueryClient(), recovered = new WeakSet<object>()
  const request = vi.fn(async () => { throw Object.assign(new Error('isolated widget failure'), { status: 503 }) })
  const observer = new QueryObserver(client, { queryKey: key, queryFn: request, retry: false })
  const unsubscribe = observer.subscribe(() => {})
  await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true))
  await refetchFailedReadsAfterRecovery(client, recovered)
  await refetchFailedReadsAfterRecovery(client, recovered)
  await refetchFailedReadsAfterRecovery(client, recovered)
  expect(request).toHaveBeenCalledTimes(2)
  unsubscribe(); client.clear()
})
