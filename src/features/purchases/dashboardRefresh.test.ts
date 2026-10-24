import { beforeEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
const h = vi.hoisted(() => ({ client: null as any }))
vi.mock('@tanstack/react-query', async original => ({ ...await original<typeof import('@tanstack/react-query')>(), useQueryClient: () => h.client }))
import { useInvalidatePurchases } from './purchase.api'
beforeEach(() => { h.client = new QueryClient() })
it('confirmed purchase refresh invalidates dashboard and inventory caches with purchase queries', async () => {
  const key = ['regional', 'dashboard', { from: '2026-10-18', to: '2026-10-18' }]
  h.client.setQueryData(key, { metrics: { stockKg: 68 } })
  h.client.setQueryData(['regional', 'inventory'], [])
  h.client.setQueryData(['purchases'], [])
  await useInvalidatePurchases()()
  expect(h.client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(h.client.getQueryState(['regional', 'inventory'])?.isInvalidated).toBe(true)
  expect(h.client.getQueryState(['purchases'])?.isInvalidated).toBe(true)
  h.client.clear()
})

