import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ ...auth, API_BASE_URL: 'http://localhost:4000/api/v1' }))

import {
  CustomerLedgerApiError,
  definitiveLedgerFailure,
  createCustomer,
  createCustomerAdjustment,
  createCustomerOpeningBalance,
  createCustomerPayment,
  createCustomerPurchase,
  getCustomerById,
  getCustomerDirectory,
  getCustomerLedger,
  getCustomerLedgerDailyPayments,
  getCustomerLedgerPaymentCalendar,
  getCustomerLedgerPaymentInsights,
  getCustomerLedgerReminderCandidate,
  getCustomerLedgerSummary,
  getCustomerLedgerErrorMessage,
  voidCustomerLedgerTransaction,
} from './customerLedgerApi'

const customerId = '507f1f77bcf86cd799439011'
const transactionId = '507f1f77bcf86cd799439012'
const saleId = '507f1f77bcf86cd799439013'
let fetchMock: ReturnType<typeof vi.fn>

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url: new URL(url), init, body: init.body ? JSON.parse(String(init.body)) as unknown : undefined }
}

beforeEach(() => {
  auth.authenticatedFetch.mockReset().mockImplementation((url, init) => fetch(url, { ...init, credentials: 'include' }))
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('customer ledger API client', () => {
  it('rejects malformed customer IDs before authentication or network requests', () => {
    expect(() => getCustomerById('not-an-id')).toThrow('Customer ID is invalid.')
    expect(() => getCustomerLedger('507f1f77bcf86cd79943901z')).toThrow('Customer ID is invalid.')
    expect(auth.authenticatedFetch).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps network failures into the existing API error without exposing browser details', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch: private-host'))

    await expect(getCustomerById(customerId)).rejects.toMatchObject({
      name: 'CustomerLedgerApiError', status: 0,
      message: 'Unable to connect. Check your connection and try again.',
    })
  })

  it('hides raw server failures and retains their HTTP status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'database password is secret' }), { status: 503 }))

    await expect(getCustomerById(customerId)).rejects.toMatchObject({
      status: 503, message: 'Unable to load account data. Please try again.',
    })
  })

  it('preserves authentication failure status from the existing token source', async () => {
    auth.authenticatedFetch.mockRejectedValueOnce(Object.assign(new Error('private token error'), { status: 401 }))

    await expect(getCustomerById(customerId)).rejects.toMatchObject({
      status: 401, message: 'Your session has expired. Sign in again.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'The customer ID or request is invalid.'],
    [401, 'Your session has expired. Sign in again.'],
    [403, 'You do not have access to this customer account.'],
    [404, 'Customer not found in this shop.'],
  ])('uses safe presentation text for HTTP %i', (status, message) => {
    expect(getCustomerLedgerErrorMessage(new CustomerLedgerApiError('private backend message', Number(status))))
      .toBe(message)
  })

  it('requests one customer by ID with existing auth and no directory pagination', async () => {
    const payload = { customer: {
      id: customerId, name: 'Ahmed Traders', phone: '+92 300 1112223',
      address: 'Main bazaar', status: 'active',
    } }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

    expect(await getCustomerById(customerId)).toEqual(payload)
    const request = lastRequest()
    expect(request.url.pathname).toBe(`/api/v1/customers/${customerId}`)
    expect(request.url.search).toBe('')
    expect(request.init.method).toBe('GET')
    expect(request.init.credentials).toBe('include')
    expect(request.body).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves customer profile not-found errors and rejects missing IDs before fetching', async () => {
    expect(() => getCustomerById('')).toThrow('Customer ID is required.')
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Customer not found.' }), { status: 404 }))

    await expect(getCustomerById(customerId)).rejects.toMatchObject({
      name: 'CustomerLedgerApiError', status: 404, message: 'Customer not found.',
    })
  })

  it('uses the existing token source and the customer-scoped ledger URL', async () => {
    await getCustomerLedger(customerId)
    const request = lastRequest()
    expect(request.url.pathname).toBe(`/api/v1/customers/${customerId}/ledger`)
    expect(request.init.method).toBe('GET')
    expect(request.init.credentials).toBe('include')
    expect(auth.authenticatedFetch).toHaveBeenCalledOnce()
  })

  it('serializes supported ledger filters without pagination or tenant fields', async () => {
    const filters = { from: '2026-10-01', to: '2026-10-31', type: 'payment' as const, status: 'active' as const, page: 2, limit: 100, shop: 'other' }
    await getCustomerLedger(customerId, filters)
    expect(lastRequest().url.searchParams.toString()).toBe('from=2026-10-01&to=2026-10-31&type=payment&status=active')
  })

  it('serializes customer directory filters without tenant fields', async () => {
    const filters = Object.assign({ page: 2, limit: 10, search: ' Ahmed ', status: 'active' as const }, { shop: 'other', owner: 'user' })

    await getCustomerDirectory(filters)

    const request = lastRequest()
    expect(request.url.pathname).toBe('/api/v1/customers')
    expect(request.url.searchParams.toString()).toBe('page=2&limit=10&search=Ahmed&status=active')
    expect(request.init.method).toBe('GET')
    expect(request.init.credentials).toBe('include')
  })

  it('creates customers with supported profile fields only', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ customer: {
      id: customerId, name: 'Ahmed Traders', phone: '+92 300 1112223', address: 'Main bazaar',
      region: 'Lahore', city: 'Lahore', notes: 'Prefers weekly follow-up', status: 'active', currentBalancePkr: 0,
    } }), { status: 201 }))
    await createCustomer(Object.assign({
      name: 'Ahmed Traders',
      phone: '+92 300 1112223',
      address: 'Main bazaar',
      region: 'Lahore',
      city: 'Lahore',
      notes: 'Prefers weekly follow-up',
      openingBalancePkr: 2500,
      idempotencyKey: 'customer-create-key',
    }, { shop: 'other', createdBy: 'other', balanceDue: 999999 }))

    const request = lastRequest()
    expect(request.url.pathname).toBe('/api/v1/customers')
    expect(request.init.method).toBe('POST')
    expect(request.body).toEqual({
      name: 'Ahmed Traders',
      phone: '+92 300 1112223',
      address: 'Main bazaar',
      region: 'Lahore',
      city: 'Lahore',
      notes: 'Prefers weekly follow-up',
      openingBalancePkr: 2500,
      idempotencyKey: 'customer-create-key',
    })
  })

  it('does not report creation success for a response without a permanent customer ID', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ customer: { id: 'temporary-id', name: 'Ahmed' } }), { status: 201 }))
    await expect(createCustomer({ name: 'Ahmed' })).rejects.toMatchObject({ status: 502 })
  })

  it('preserves customer creation field validation errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Validation failed.', issues: [{ path: 'city', message: 'City is required.' }] }), { status: 400 }))
    await expect(createCustomer({ name: 'Ahmed', city: '' })).rejects.toMatchObject({ status: 400, issues: [{ path: 'city', message: 'City is required.' }] })
  })

  it('passes the standalone payment retry key without tenant or operator overrides', async () => {
    await createCustomerPayment(customerId, Object.assign({ businessDate: '2026-10-13', amountPkr: 4000, paymentMethod: 'cash' as const, idempotencyKey: 'payment-retry-key' }, { shop: 'other', createdBy: 'other' }))
    expect(lastRequest().body).toEqual({ businessDate: '2026-10-13', amountPkr: 4000, paymentMethod: 'cash', idempotencyKey: 'payment-retry-key' })
  })

  it('uses the backend summary and date-range read endpoints', async () => {
    await getCustomerLedgerSummary(customerId, '2026-10-31')
    expect(lastRequest().url.pathname).toBe(`/api/v1/customers/${customerId}/summary`)
    expect(lastRequest().url.searchParams.get('referenceDate')).toBe('2026-10-31')

    const range = { from: '2026-10-01', to: '2026-10-31' }
    await getCustomerLedgerDailyPayments(customerId, range)
    expect(lastRequest().url.pathname).toBe(`/api/v1/customers/${customerId}/daily-payments`)
    expect(lastRequest().url.searchParams.toString()).toBe('from=2026-10-01&to=2026-10-31')

    await getCustomerLedgerPaymentInsights(customerId, { ...range, referenceDate: '2026-10-31' })
    expect(lastRequest().url.pathname).toBe(`/api/v1/customers/${customerId}/payment-insights`)
    expect(lastRequest().url.searchParams.get('referenceDate')).toBe('2026-10-31')

    await getCustomerLedgerPaymentCalendar(customerId, range)
    expect(lastRequest().url.pathname).toBe(`/api/v1/customers/${customerId}/payment-calendar`)
    expect(lastRequest().url.searchParams.toString()).toBe('from=2026-10-01&to=2026-10-31')
  })

  it('sends caller-provided reminder threshold without a hardcoded default', async () => {
    await getCustomerLedgerReminderCandidate(customerId, 9, '2026-10-31')
    const request = lastRequest()
    expect(request.url.pathname).toBe(`/api/v1/customers/${customerId}/reminder-candidate`)
    expect(request.url.searchParams.toString()).toBe('thresholdDays=9&referenceDate=2026-10-31')
  })

  it('sends saleId and purchase inputs but never caller-calculated amount or identity', async () => {
    const input = Object.assign({
      businessDate: '2026-10-01', saleId, teaType: 'green' as const,
      stockLocationId: 'main', quantityKg: 10, ratePerKgPkr: 500, notes: 'Counter',
    }, { amountPkr: 999999, shop: 'other', customerId: 'other', createdBy: 'other' })
    await createCustomerPurchase(customerId, input)
    const request = lastRequest()
    expect(request.url.pathname).toBe(`/api/v1/customers/${customerId}/purchases`)
    expect(request.init.method).toBe('POST')
    expect(request.body).toEqual({
      businessDate: '2026-10-01', saleId, teaType: 'green', stockLocationId: 'main',
      quantityKg: 10, ratePerKgPkr: 500, notes: 'Counter',
    })
  })

  it('sends only supported payment and opening balance fields', async () => {
    const payment = Object.assign({ businessDate: '2026-10-01', amountPkr: 1000, paymentMethod: 'cash' as const },
      { shop: 'other', customerId: 'other', createdBy: 'other', balance: 9000 })
    await createCustomerPayment(customerId, payment)
    expect(lastRequest().body).toEqual({ businessDate: '2026-10-01', amountPkr: 1000, paymentMethod: 'cash' })

    const opening = Object.assign({ businessDate: '2026-10-01', amountPkr: 5000 }, { balance: 5000, shop: 'other' })
    await createCustomerOpeningBalance(customerId, opening)
    expect(lastRequest().body).toEqual({ businessDate: '2026-10-01', amountPkr: 5000 })
  })

  it('sends adjustment reason and only the server-supported fields', async () => {
    await createCustomerAdjustment(customerId, { businessDate: '2026-10-01', amountPkr: -100, reason: 'Correction' })
    expect(lastRequest().url.pathname).toBe(`/api/v1/customers/${customerId}/adjustments`)
    expect(lastRequest().body).toEqual({ businessDate: '2026-10-01', amountPkr: -100, reason: 'Correction' })
  })

  it('voids by PATCH with transaction ID and reason only', async () => {
    await voidCustomerLedgerTransaction(customerId, transactionId, 'Duplicate')
    const request = lastRequest()
    expect(request.url.pathname).toBe(`/api/v1/customers/${customerId}/transactions/${transactionId}/void`)
    expect(request.init.method).toBe('PATCH')
    expect(request.body).toEqual({ reason: 'Duplicate' })
  })

  it('preserves backend status, message and validation issues', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'Validation failed.', issues: [{ path: 'amountPkr', message: 'Must be an integer.' }],
    }), { status: 400 }))
    await expect(createCustomerPayment(customerId, { businessDate: '2026-10-01', amountPkr: 1.5, paymentMethod: 'cash' }))
      .rejects.toMatchObject({ status: 400, message: 'Validation failed.', issues: [{ path: 'amountPkr' }] })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Payment cannot exceed the active customer balance.' }), { status: 409 }))
    await expect(createCustomerPayment(customerId, { businessDate: '2026-10-01', amountPkr: 1000, paymentMethod: 'cash' }))
      .rejects.toBeInstanceOf(CustomerLedgerApiError)
  })

  it('does not call fetch for a missing customer ID or failed existing auth', async () => {
    expect(() => getCustomerLedger('')).toThrow('Customer ID is required.')
    expect(fetchMock).not.toHaveBeenCalled()
    auth.authenticatedFetch.mockRejectedValueOnce(new Error('No token'))
    await expect(getCustomerLedger(customerId)).rejects.toMatchObject({ status: 0, message: 'Unable to connect. Check your connection and try again.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('uncertain payment retry classification', () => {
  it('retains the same financial intent after a timeout or a later terminal response', () => {
    expect(definitiveLedgerFailure(new CustomerLedgerApiError('Timed out',408),false)).toBe(false)
    expect(definitiveLedgerFailure(new CustomerLedgerApiError('Session changed after dispatch',401,undefined,true),false)).toBe(false)
    for(const status of [400,401,403,409,429])expect(definitiveLedgerFailure(new CustomerLedgerApiError('Rejected',status),true)).toBe(false)
    expect(definitiveLedgerFailure(new CustomerLedgerApiError('Invalid amount',400),false)).toBe(true)
  })
})
