vi.mock('../auth/auth.store', () => ({ useAuthStore: (selector: (state: any) => unknown) => selector({ session: null }) }))
import { scopedKey } from '../auth/queryScope'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reactQuery = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}))
const api = vi.hoisted(() => ({
  getCustomerById: vi.fn(),
  getCustomerDirectory: vi.fn(),
  getCustomerLedger: vi.fn(),
  getCustomerLedgerSummary: vi.fn(),
  getCustomerLedgerDailyPayments: vi.fn(),
  getCustomerLedgerPaymentInsights: vi.fn(),
  getCustomerLedgerPaymentCalendar: vi.fn(),
  getCustomerLedgerReminderCandidate: vi.fn(),
  createCustomerPurchase: vi.fn(),
  createCustomer: vi.fn(),
  createCustomerPayment: vi.fn(),
  createCustomerOpeningBalance: vi.fn(),
  createCustomerAdjustment: vi.fn(),
  voidCustomerLedgerTransaction: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => reactQuery)
vi.mock('./customerLedgerApi', async importOriginal => ({
  ...await importOriginal<typeof import('./customerLedgerApi')>(),
  ...api,
}))

import { CustomerLedgerApiError } from './customerLedgerApi'
import { customerLedgerKeys } from './queryKeys'
import {
  useCreateCustomerAdjustment,
  useCreateCustomer,
  useCreateCustomerOpeningBalance,
  useCreateCustomerPayment,
  useCreateCustomerPurchase,
  useCustomerById,
  useCustomerDirectory,
  useCustomerLedger,
  useCustomerLedgerDailyPayments,
  useCustomerLedgerPaymentCalendar,
  useCustomerLedgerPaymentInsights,
  useCustomerLedgerReminderCandidate,
  useCustomerLedgerSummary,
  useVoidCustomerLedgerTransaction,
} from './useCustomerLedger'

const customerId = '507f1f77bcf86cd799439011'
const range = { from: '2026-10-01', to: '2026-10-31' }
const invalidateQueries = vi.fn()
const setQueryData = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  reactQuery.useQueryClient.mockReturnValue({ invalidateQueries, setQueryData })
  for (const fn of Object.values(api)) fn.mockResolvedValue({})
  invalidateQueries.mockResolvedValue(undefined)
})

describe('customer ledger query hooks', () => {
  it('refreshes customer searches and caches only the backend-confirmed customer after creation', async () => {
    useCreateCustomer()
    const options = reactQuery.useMutation.mock.calls.at(-1)?.[0]
    expect(options.retry).toBe(false)
    const customer = { id: customerId, name: 'Ahmed', city: 'Lahore', status: 'active' }
    await options.onSuccess({ customer })
    expect(setQueryData).toHaveBeenCalledWith(scopedKey(customerLedgerKeys.profile(customerId), null), { customer })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.directory().slice(0, -1) })
  })
  it('queries a single customer with a distinct customer-specific profile key', async () => {
    useCustomerById(customerId)
    const options = reactQuery.useQuery.mock.calls.at(-1)?.[0]

    expect(options.queryKey).toEqual(scopedKey(customerLedgerKeys.profile(customerId), null))
    expect(options.enabled).toBe(true)
    await options.queryFn()
    expect(api.getCustomerById).toHaveBeenCalledWith(customerId)
    expect(customerLedgerKeys.profile(customerId)).not.toEqual(customerLedgerKeys.directory())
    expect(customerLedgerKeys.profile(customerId)).not.toEqual(customerLedgerKeys.ledger(customerId))
    expect(customerLedgerKeys.profile(customerId)).not.toEqual(customerLedgerKeys.profile('customer-b'))
  })

  it.each([undefined, '', 'not-an-id', '507f1f77bcf86cd79943901z'])('disables the profile query for an invalid ID: %s', id => {
    useCustomerById(id)
    const options = reactQuery.useQuery.mock.calls.at(-1)?.[0]

    expect(options.enabled).toBe(false)
    expect(() => options.queryFn()).toThrow(id ? 'Customer ID is invalid.' : 'Customer ID is required.')
    expect(api.getCustomerById).not.toHaveBeenCalled()
  })

  it('uses customer-scoped keys that distinguish resources and filter values', () => {
    expect(customerLedgerKeys.ledger(customerId, { type: 'payment' })).not.toEqual(customerLedgerKeys.ledger(customerId, { type: 'purchase' }))
    expect(customerLedgerKeys.summary(customerId)).not.toEqual(customerLedgerKeys.summary('customer-b'))
    const prefix = customerLedgerKeys.customer(customerId)
    for (const key of [
      customerLedgerKeys.ledger(customerId),
      customerLedgerKeys.summary(customerId),
      customerLedgerKeys.dailyPayments(customerId, range),
      customerLedgerKeys.paymentInsights(customerId, range),
      customerLedgerKeys.paymentCalendar(customerId, range),
      customerLedgerKeys.reminderCandidate(customerId, 7),
    ]) {
      expect(key.slice(0, prefix.length)).toEqual(prefix)
    }
    expect(customerLedgerKeys.profile(customerId).slice(0, prefix.length)).not.toEqual(prefix)
  })

  it('allows sale search to disable empty and unsettled queries without changing directory defaults', () => {
    useCustomerDirectory({ search: '', limit: 8 }, false)
    expect(reactQuery.useQuery.mock.calls.at(-1)?.[0].enabled).toBe(false)
    useCustomerDirectory({ search: 'Ahmed', limit: 8 }, true)
    expect(reactQuery.useQuery.mock.calls.at(-1)?.[0].enabled).toBe(true)
    useCustomerDirectory()
    expect(reactQuery.useQuery.mock.calls.at(-1)?.[0].enabled).toBe(true)
  })
  it('reuses fresh directory data for 30 seconds while mutation invalidation remains active', async () => {
    useCustomerDirectory({ page: 2, search: ' Ahmed ' })
    const options = reactQuery.useQuery.mock.calls.at(-1)?.[0]

    expect(options.refetchOnMount).toBeUndefined(); expect(options.staleTime).toBe(30000)
    await options.queryFn()
    expect(api.getCustomerDirectory).toHaveBeenCalledWith({ search: 'Ahmed', status: '', page: 2, limit: 20 })
  })

  it('retries network/server failures once and avoids automatic retries for terminal HTTP errors', () => {
    useCustomerById(customerId)
    const options = reactQuery.useQuery.mock.calls.at(-1)?.[0]
    for (const status of [400, 401, 403, 404, 409]) {
      expect(options.retry(0, new CustomerLedgerApiError('Request failed', status))).toBe(false)
    }
    for (const status of [0, 500, 503]) {
      expect(options.retry(0, new CustomerLedgerApiError('Request failed', status))).toBe(true)
      expect(options.retry(1, new CustomerLedgerApiError('Request failed', status))).toBe(false)
    }
  })

  it('disables all account reads for malformed IDs', () => {
    useCustomerById('invalid')
    useCustomerLedger('invalid')
    useCustomerLedgerSummary('invalid')
    useCustomerLedgerDailyPayments('invalid', range)
    useCustomerLedgerPaymentInsights('invalid', range)
    useCustomerLedgerPaymentCalendar('invalid', range)
    useCustomerLedgerReminderCandidate('invalid', 7)

    for (const [options] of reactQuery.useQuery.mock.calls) expect(options.enabled).toBe(false)
    for (const method of Object.values(api)) expect(method).not.toHaveBeenCalled()
  })

  it.each([
    { from: '2026-10-03', to: '2026-10-01' },
    { from: '2026-02-30', to: '2026-10-31' },
  ])('disables queries for an invalid business-date range: %j', invalidRange => {
    useCustomerLedger(customerId, invalidRange)
    useCustomerLedgerDailyPayments(customerId, invalidRange)
    useCustomerLedgerPaymentInsights(customerId, invalidRange)
    useCustomerLedgerPaymentCalendar(customerId, invalidRange)
    for (const [options] of reactQuery.useQuery.mock.calls) expect(options.enabled).toBe(false)
  })

  it('uses new keys and request dates for changed ranges without changing identity or all-time summary keys', async () => {
    const next = { from: '2026-09-01', to: '2026-09-30' }
    for (const dates of [range, next]) {
      useCustomerLedger(customerId, dates)
      useCustomerLedgerDailyPayments(customerId, dates)
      useCustomerLedgerPaymentInsights(customerId, dates)
      useCustomerLedgerPaymentCalendar(customerId, dates)
    }
    const options = reactQuery.useQuery.mock.calls.map(([query]) => query)
    for (let index = 0; index < 4; index += 1) {
      expect(options[index].queryKey).not.toEqual(options[index + 4].queryKey)
      expect(options[index + 4].enabled).toBe(true)
      await options[index + 4].queryFn()
    }
    expect(api.getCustomerLedger).toHaveBeenCalledWith(customerId, next)
    expect(api.getCustomerLedgerDailyPayments).toHaveBeenCalledWith(customerId, next)
    expect(api.getCustomerLedgerPaymentInsights).toHaveBeenCalledWith(customerId, next)
    expect(api.getCustomerLedgerPaymentCalendar).toHaveBeenCalledWith(customerId, next)
    expect(api.getCustomerById).not.toHaveBeenCalled()
    expect(api.getCustomerLedgerSummary).not.toHaveBeenCalled()
  })

  it('passes each read hook to its API method with the requested customer and parameters', async () => {
    const filters = { type: 'payment' as const }
    useCustomerLedger(customerId, filters)
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedger).toHaveBeenCalledWith(customerId, filters)

    useCustomerLedgerSummary(customerId, '2026-10-31')
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedgerSummary).toHaveBeenCalledWith(customerId, '2026-10-31')

    useCustomerLedgerDailyPayments(customerId, range)
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedgerDailyPayments).toHaveBeenCalledWith(customerId, range)

    const insights = { ...range, referenceDate: '2026-10-31' }
    useCustomerLedgerPaymentInsights(customerId, insights)
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedgerPaymentInsights).toHaveBeenCalledWith(customerId, insights)

    useCustomerLedgerPaymentCalendar(customerId, range)
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedgerPaymentCalendar).toHaveBeenCalledWith(customerId, range)

    useCustomerLedgerReminderCandidate(customerId, 9, '2026-10-31')
    await reactQuery.useQuery.mock.calls.at(-1)?.[0].queryFn()
    expect(api.getCustomerLedgerReminderCandidate).toHaveBeenCalledWith(customerId, 9, '2026-10-31')
  })

  it('disables reads with missing customer IDs and never calls the API', async () => {
    useCustomerLedger(undefined)
    const options = reactQuery.useQuery.mock.calls.at(-1)?.[0]
    expect(options.enabled).toBe(false)
    expect(() => options.queryFn()).toThrow('Customer ID is required.')
    expect(api.getCustomerLedger).not.toHaveBeenCalled()

    useCustomerLedgerSummary(undefined)
    useCustomerLedgerDailyPayments(undefined, range)
    useCustomerLedgerPaymentInsights(undefined, range)
    useCustomerLedgerPaymentCalendar(undefined, range)
    useCustomerLedgerReminderCandidate(undefined, 7)
    for (const [options] of reactQuery.useQuery.mock.calls) expect(options.enabled).toBe(false)
  })
})

describe('customer ledger mutation hooks', () => {
  it('invalidates every derived resource under only the affected customer after each write', async () => {
    const purchase = { businessDate: '2026-10-01', saleId: 'sale-a', teaType: 'green' as const, stockLocationId: 'main', quantityKg: 10, ratePerKgPkr: 500 }
    const payment = { businessDate: '2026-10-01', amountPkr: 1000, paymentMethod: 'cash' as const }
    const opening = { businessDate: '2026-10-01', amountPkr: 5000 }
    const adjustment = { businessDate: '2026-10-01', amountPkr: -100, reason: 'Correction' }
    const voidInput = { transactionId: 'tx-a', reason: 'Duplicate' }

    const cases = [
      { useHook: useCreateCustomerPurchase, input: purchase, apiMethod: api.createCustomerPurchase },
      { useHook: useCreateCustomerPayment, input: payment, apiMethod: api.createCustomerPayment },
      { useHook: useCreateCustomerOpeningBalance, input: opening, apiMethod: api.createCustomerOpeningBalance },
      { useHook: useCreateCustomerAdjustment, input: adjustment, apiMethod: api.createCustomerAdjustment },
      { useHook: useVoidCustomerLedgerTransaction, input: voidInput, apiMethod: api.voidCustomerLedgerTransaction },
    ]

    for (const item of cases) {
      item.useHook(customerId)
      const options = reactQuery.useMutation.mock.calls.at(-1)?.[0]
      await options.mutationFn(item.input)
      if (item.apiMethod === api.voidCustomerLedgerTransaction) {
        expect(item.apiMethod).toHaveBeenCalledWith(customerId, 'tx-a', 'Duplicate')
      } else {
        expect(item.apiMethod).toHaveBeenCalledWith(customerId, item.input)
      }
      await options.onSuccess()
    }

    expect(invalidateQueries).toHaveBeenCalledTimes(30)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['collections'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.customer(customerId) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: customerLedgerKeys.directory().slice(0, -1) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales'] })
  })

  it('invalidates actual ledger and directory caches while preserving profile and other customer caches', async () => {
    const { QueryClient } = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    const client = new QueryClient()
    const ledgerKeys = [
      customerLedgerKeys.ledger(customerId), customerLedgerKeys.summary(customerId),
      customerLedgerKeys.dailyPayments(customerId, range), customerLedgerKeys.paymentInsights(customerId, range),
      customerLedgerKeys.paymentCalendar(customerId, range), customerLedgerKeys.reminderCandidate(customerId, 7),
    ]
    const directoryKeys = [customerLedgerKeys.directory(), customerLedgerKeys.directory({ page: 2, search: 'Ahmed' }), ['sales', 'summary', '2026-10-01']]
    const preservedKeys = [customerLedgerKeys.profile(customerId), customerLedgerKeys.summary('507f1f77bcf86cd799439012')]
    for (const key of [...ledgerKeys, ...directoryKeys, ...preservedKeys]) client.setQueryData(key, {})
    invalidateQueries.mockImplementation(input => client.invalidateQueries(input))

    useCreateCustomerPayment(customerId)
    await reactQuery.useMutation.mock.calls.at(-1)?.[0].onSuccess()

    for (const key of [...ledgerKeys, ...directoryKeys]) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    for (const key of preservedKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(false)
    client.clear()
  })

  it('keeps the profile out of the existing Sales customer-family invalidation', async () => {
    const { QueryClient } = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    const client = new QueryClient()
    client.setQueryData(customerLedgerKeys.profile(customerId), {})
    client.setQueryData(customerLedgerKeys.summary(customerId), {})

    await client.invalidateQueries({ queryKey: customerLedgerKeys.customer(customerId) })

    expect(client.getQueryState(customerLedgerKeys.profile(customerId))?.isInvalidated).toBe(false)
    expect(client.getQueryState(customerLedgerKeys.summary(customerId))?.isInvalidated).toBe(true)
    client.clear()
  })

  it('does not invoke a mutation API without a customer ID', async () => {
    useCreateCustomerPayment(undefined)
    const options = reactQuery.useMutation.mock.calls.at(-1)?.[0]
    expect(() => options.mutationFn({ businessDate: '2026-10-01', amountPkr: 100, paymentMethod: 'cash' }))
      .toThrow('Customer ID is required.')
    expect(api.createCustomerPayment).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})


