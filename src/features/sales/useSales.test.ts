vi.mock('../auth/auth.store', () => ({ useAuthStore: (selector: (state: any) => unknown) => selector({ session: null }) }))
import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({ useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() }))
const api = vi.hoisted(() => ({ getSales: vi.fn(), getTopSellingProducts: vi.fn(), createSale: vi.fn(), updateSale: vi.fn(), voidSale: vi.fn() }))
vi.mock('@tanstack/react-query', () => query)
vi.mock('./services/sales.service', () => api)

import { customerLedgerKeys } from '../customer-ledger/queryKeys'
import { notificationKeys } from '../notifications/queryKeys'
import { scopedKey } from '../auth/queryScope'
import { salesKeys } from './queryKeys'
import { useCreateSale, useSales, useUpdateSale, useVoidSale, useTopSellingProducts } from './useSales'
import { customerId, sale, saleId, saleInput } from './test/fixtures'

const invalidateQueries = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  vi.clearAllMocks()
  query.useQueryClient.mockReturnValue({ invalidateQueries })
  api.createSale.mockResolvedValue({ sale })
})

describe('Sales React Query hooks', () => {
  it('invalidates cached dashboard totals and rankings after a confirmed sale or cancellation', async () => {
    const { QueryClient } = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    const client = new QueryClient()
    query.useQueryClient.mockReturnValue(client)
    const dashboardKey = ['regional', 'dashboard', { from: '2026-10-18', to: '2026-10-18' }]
    const productsKey = salesKeys.topProducts({ from: '2026-10-18', to: '2026-10-18' })
    for (const hook of [useCreateSale, useVoidSale]) {
      client.setQueryData(dashboardKey, { orders: 1 })
      client.setQueryData(productsKey, { products: [] })
      hook()
      await query.useMutation.mock.lastCall?.[0].onSuccess({ sale })
      expect(client.getQueryState(dashboardKey)?.isInvalidated).toBe(true)
      expect(client.getQueryState(productsKey)?.isInvalidated).toBe(true)
    }
    client.clear()
  })
  it('fetches Sales under real filter-aware keys', async () => {
    const filters = { status: 'pending' as const }
    useSales(filters)
    const options = query.useQuery.mock.lastCall?.[0]
    expect(options.queryKey).toEqual(scopedKey(salesKeys.list(filters), null))
    await options.queryFn()
    expect(api.getSales).toHaveBeenCalledWith(filters)
    expect(salesKeys.list(filters)).not.toEqual(salesKeys.list({ status: 'completed' }))
  })

  it('keys top-product queries by date and selling region and consumes abort signals', async () => {
    const filters = { from: '2026-10-10', to: '2026-10-16', regionId: '507f1f77bcf86cd799439001' }
    useTopSellingProducts(filters)
    const options = query.useQuery.mock.lastCall?.[0]
    expect(options.queryKey).toEqual(scopedKey(salesKeys.topProducts(filters), null))
    const signal = new AbortController().signal
    await options.queryFn({ signal })
    expect(api.getTopSellingProducts).toHaveBeenCalledWith(filters, signal)
    expect(options.refetchOnMount).toBeUndefined(); expect(options.refetchOnWindowFocus).toBe(true)
    expect(options.placeholderData).toBeUndefined()
    expect(salesKeys.topProducts(filters)).not.toEqual(salesKeys.topProducts({ ...filters, regionId: undefined }))
    expect(salesKeys.topProducts(filters)).not.toEqual(salesKeys.topProducts({ ...filters, from: '2026-10-16' }))
  })
  it.each([useCreateSale, useVoidSale])('invalidates all top-product period and region variants only after confirmed mutation success', async hook => {
    hook()
    const options = query.useMutation.mock.lastCall?.[0]
    expect(invalidateQueries).not.toHaveBeenCalled()
    await options.onSuccess({ sale })
    const key = salesKeys.topProducts({ from: '2026-10-16', to: '2026-10-16' })
    expect(invalidateQueries.mock.calls.some(([input]) => input.queryKey.every((part: unknown, index: number) => part === key[index]))).toBe(true)
  })
  it('passes a caller-owned key unchanged and disables automatic mutation retry', async () => {
    useCreateSale()
    const options = query.useMutation.mock.lastCall?.[0]
    const input = { ...saleInput, idempotencyKey: 'caller-key' }
    await options.mutationFn(input)
    expect(api.createSale).toHaveBeenCalledWith(input)
    expect(options.retry).toBe(false)
  })

  it('invalidates only Sales, notification reads and the affected customer resources', async () => {
    useCreateSale()
    await query.useMutation.mock.lastCall?.[0].onSuccess({ sale: { ...sale, customer: customerId, paymentMethod: 'credit' } })
    expect(invalidateQueries.mock.calls.map(([input]) => input.queryKey)).toEqual([
      salesKeys.all, ['regional'], customerLedgerKeys.directory().slice(0, -1), notificationKeys.lists(), notificationKeys.unreadCount(), customerLedgerKeys.customer(customerId),
    ])
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['inventory'] })
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('has no customer invalidation for an unlinked cash sale, and no manual cache append', async () => {
    useCreateSale()
    await query.useMutation.mock.lastCall?.[0].onSuccess({ sale })
    expect(invalidateQueries).toHaveBeenCalledTimes(5)
    expect(invalidateQueries.mock.calls.map(([input]) => input.queryKey)).toEqual([
      salesKeys.all, ['regional'], customerLedgerKeys.directory().slice(0, -1), notificationKeys.lists(), notificationKeys.unreadCount(),
    ])
    expect(Object.keys(query.useMutation.mock.lastCall?.[0])).toEqual(['mutationFn', 'retry', 'onSuccess'])
  })

  it('invalidates both customers on reassignment without duplicating a matching customer', async () => {
    const previousCustomerId = '507f1f77bcf86cd799439019'
    useUpdateSale(saleId, previousCustomerId)
    const options = query.useMutation.mock.lastCall?.[0]
    await options.mutationFn({ customerId, notes: 'Corrected customer' })
    expect(api.updateSale).toHaveBeenCalledWith(saleId, { customerId, notes: 'Corrected customer' })
    await options.onSuccess({ sale: { ...sale, customer: customerId } })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.customer(customerId) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.customer(previousCustomerId) })
    invalidateQueries.mockClear()
    useUpdateSale(saleId, customerId)
    await query.useMutation.mock.lastCall?.[0].onSuccess({ sale: { ...sale, customer: customerId } })
    expect(invalidateQueries).toHaveBeenCalledTimes(6)
  })

  it('voids through the API and refreshes ledger state without local accounting', async () => {
    useVoidSale()
    const options = query.useMutation.mock.lastCall?.[0]
    await options.mutationFn({ saleId, reason: 'Correction' })
    expect(api.voidSale).toHaveBeenCalledWith(saleId, 'Correction')
    expect(options.retry).toBe(false)
    await options.onSuccess({ sale: { ...sale, customer: customerId, status: 'voided' } })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.customer(customerId) })
  })
})
