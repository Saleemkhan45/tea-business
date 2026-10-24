import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))
vi.mock('../../auth/auth.api', () => ({ ...auth, API_BASE_URL: 'http://localhost:4000/api/v1' }))

import { createSale, getSaleEntryOptions, getSales, getTopSellingProducts, getSalesErrorMessage, SalesApiError, updateSale, voidSale } from './sales.service'
import { customerId, sale, saleId, saleInput, stockLocationId } from '../test/fixtures'

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
const input = { ...saleInput, idempotencyKey: 'operation-a' }

function respond(body: object = { sale }, status = 201) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))
}

function request() {
  const call = fetchMock.mock.lastCall
  if (!call) throw new Error('Expected an HTTP request.')
  const [url, init] = call
  const body: unknown = init.body ? JSON.parse(String(init.body)) : undefined
  return { url: new URL(url), init, body }
}

beforeEach(() => {
  fetchMock.mockReset()
  auth.authenticatedFetch.mockReset().mockImplementation((url, init) => fetch(url, { ...init, credentials: 'include' }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Sales API contract', () => {
  it('loads bounded top-product results using authenticated dates and fulfillment-region filters', async () => {
    const product = { productId: stockLocationId, name: 'Snapshot product', quantityKg: .125 }
    const response = { from: '2026-10-10', to: '2026-10-16', regionId: stockLocationId, products: [product] }
    respond(response, 200)
    const signal = new AbortController().signal
    await expect(getTopSellingProducts({ from: response.from, to: response.to, regionId: stockLocationId }, signal)).resolves.toEqual(response)
    expect(request().url.pathname).toBe('/api/v1/sales/top-products')
    expect(request().url.searchParams.get('regionId')).toBe(stockLocationId)
    expect(request().url.searchParams.get('from')).toBe(response.from)
    expect(request().init.signal).toBe(signal)
    expect(request().init.method).toBe('GET')
    expect(auth.authenticatedFetch).toHaveBeenCalledOnce()
  })
  it('does not disguise a failed ranking request as an empty result', async () => {
    respond({ message: 'Unavailable' }, 503)
    await expect(getTopSellingProducts({ from: '2026-10-16', to: '2026-10-16' })).rejects.toMatchObject({ status: 503 })
  })
  it('rejects malformed ranking data rather than inventing products', async () => {
    respond({ from: '2026-10-16', to: '2026-10-16', regionId: null, products: [{ productId: stockLocationId, name: 'Invalid zero', quantityKg: 0 }] }, 200)
    await expect(getTopSellingProducts({ from: '2026-10-16', to: '2026-10-16' })).rejects.toThrow()
  })
  it('includes the caller key and reuses existing authentication', async () => {
    respond()
    await createSale(input)
    expect(request().url.pathname).toBe('/api/v1/sales')
    expect(request().url.search).toBe('')
    expect(request().init.method).toBe('POST')
    expect(request().init.credentials).toBe('include')
    expect(request().body).toEqual(input)
    expect(auth.authenticatedFetch).toHaveBeenCalledOnce()
  })

  it('sends customerId for a credit sale, not a name as its identity', async () => {
    respond({ sale: { ...sale, customer: customerId, paymentMethod: 'credit' } })
    await createSale({ ...input, customerId, customerName: undefined, paymentMethod: 'credit' })
    expect(request().body).toMatchObject({ customerId, paymentMethod: 'credit', idempotencyKey: input.idempotencyKey })
    expect(request().body).not.toHaveProperty('customerName')
  })

  it('sends a staged new customer in the same idempotent sale request', async () => {
    const newCustomer = {
      name: 'New Retailer', phone: '0300 1234567', city: 'Lahore', region: 'Punjab',
      address: 'Main Road', notes: 'Weekly delivery', openingBalancePkr: 2500,
    }
    respond({ sale: { ...sale, customer: customerId, customerName: newCustomer.name, paymentMethod: 'credit' } })

    await createSale({ ...input, customerName: newCustomer.name, newCustomer, paymentMethod: 'credit', amountPaid: 0 })

    expect(request().body).toMatchObject({ newCustomer, paymentMethod: 'credit', idempotencyKey: input.idempotencyKey })
    expect(request().body).not.toHaveProperty('customerId')
  })

  it('loads validated live inventory metadata from the protected sales catalog', async () => {
    const item = { id: stockLocationId, name: 'Green Tea Classic', teaType: 'green', availableKg: 25, sellingPrice: 1500, lowStockThreshold: 20, updatedAt: '2026-10-14T08:00:00.000Z' }
    const inventorySummary = { totalItems: 2, activeItems: 1, inactiveItems: 1, sellableItems: 1, outOfStockItems: 0 }
    respond({ operator: { id: customerId, name: 'Admin', role: 'admin' }, inventorySummary, items: [item] }, 200)

    await expect(getSaleEntryOptions()).resolves.toEqual({ operator: { id: customerId, name: 'Admin', role: 'admin' }, inventorySummary, items: [item] })
    expect(request().url.pathname).toBe('/api/v1/sales/entry-options')
    expect(auth.authenticatedFetch).toHaveBeenCalledOnce()
  })

  it('allows a cash sale without customerId', async () => {
    respond()
    await createSale(input)
    expect(request().body).not.toHaveProperty('customerId')
    expect(request().body).toMatchObject({ paymentMethod: 'cash' })
  })

  it('transmits business salesperson attribution without an audit actor override', async () => {
    respond()
    await createSale({ ...input, salespersonName: 'Ali' })
    expect(request().body).toMatchObject({ salespersonName: 'Ali' })
    expect(request().body).not.toHaveProperty('createdBy')
  })

  it('allowlists fields and never sends totals, balance, tenant, staff or operator', async () => {
    respond()
    await createSale(Object.assign({}, input, {
      amountPkr: 999, totalAmount: 999, balance: 999, shop: 'other', operator: 'other',
      createdBy: 'other', region: 'Lahore', enteredBy: 'Admin', inventoryMovements: [],
    }))
    expect(request().body).toEqual(input)
  })

  it('treats repeated 201 { sale } responses as the same successful result', async () => {
    respond()
    respond()
    expect(await createSale(input)).toEqual({ sale })
    expect(await createSale(input)).toEqual({ sale })
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
    expect(request().body).toEqual(input)
  })

  it.each([400, 401, 403, 404, 409])('surfaces business HTTP %s and the server message', async status => {
    respond({ message: 'Sale request rejected.' }, status)
    await expect(createSale(input)).rejects.toMatchObject({ name: 'SalesApiError', status, message: 'Sale request rejected.' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves a 409 idempotency conflict without an automatic retry', async () => {
    const message = 'Idempotency key was already used for a different sale request.'
    respond({ message }, 409)
    await expect(createSale(input)).rejects.toEqual(new SalesApiError(message, 409))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves validation issues and handles a non-JSON failure', async () => {
    respond({ message: 'Validation failed.', issues: [{ path: 'quantityKg', message: 'Invalid quantity.' }] }, 400)
    await expect(createSale(input)).rejects.toMatchObject({ issues: [{ path: 'quantityKg', message: 'Invalid quantity.' }] })
    fetchMock.mockResolvedValueOnce(new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' }))
    await expect(createSale(input)).rejects.toMatchObject({ status: 503, message: 'Sales are temporarily unavailable. Please try again.' })
  })

  it('does not generate keys or retry in the fetch layer', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(createSale(input)).rejects.toMatchObject({ status: 0, message: 'Unable to connect. Check your connection and try again.' })
    expect(request().body).toMatchObject({ idempotencyKey: 'operation-a' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('lists server sales using only supported filters', async () => {
    respond({ sales: [sale] }, 200)
    expect(await getSales(Object.assign({ from: '2026-10-01', status: 'completed' as const }, { shop: 'other', region: 'Lahore' }))).toEqual({ sales: [sale] })
    expect(request().url.searchParams.toString()).toBe('from=2026-10-01&status=completed')
  })

  it('uses PATCH for edits and voids, never deletion or payment writes', async () => {
    respond({ sale }, 200)
    await updateSale(saleId, Object.assign({ notes: 'Correction' }, { idempotencyKey: 'other', totalAmount: 1 }))
    expect(request().url.pathname).toBe(`/api/v1/sales/${saleId}`)
    expect(request().init.method).toBe('PATCH')
    expect(request().body).toEqual({ notes: 'Correction' })
    respond({ sale: { ...sale, status: 'voided' } }, 200)
    await voidSale(saleId, 'Duplicate entry')
    expect(request().url.pathname).toBe(`/api/v1/sales/${saleId}/void`)
    expect(request().body).toEqual({ reason: 'Duplicate entry' })
  })

  it('rejects malformed server successes without fabricating a sale', async () => {
    respond({ sale: { id: 'fake', totalAmount: 999 } })
    await expect(createSale(input)).rejects.toThrow()
  })

  it('hides unexpected server failures and validation details', async () => {
    respond({ message: 'private database stack', issues: [{ path: 'internal', message: 'private detail' }] }, 500)
    await expect(createSale(input)).rejects.toMatchObject({ status: 500, message: 'Sales are temporarily unavailable. Please try again.', issues: undefined })
    expect(getSalesErrorMessage(new Error('private stack'))).not.toContain('private stack')
  })

  it('explains the established cancellation conflict without changing accounting', () => {
    const error = new SalesApiError('Sale cancellation would create a negative customer balance. Resolve later payments or ledger activity before cancelling this sale.', 409)
    expect(getSalesErrorMessage(error)).toContain('later customer payments')
    expect(getSalesErrorMessage(error)).toContain("Review the customer's ledger first.")
  })

  it('explains stock and customer availability errors', () => {
    expect(getSalesErrorMessage(new SalesApiError('Insufficient stock for sale.', 409))).toContain('Refresh inventory')
    expect(getSalesErrorMessage(new SalesApiError('Customer not found.', 404))).toContain('Select an active customer')
  })
})

it('passes the explicit fulfillment region and regional stock ID without deriving either from the customer', async () => {
  respond()
  await createSale({ ...input, sellingRegion: customerId })
  expect(request().body).toMatchObject({ sellingRegion: customerId, stockLocationId })
})
it('loads entry options for exactly the requested region', async () => {
  respond({ operator: { id: customerId, name: 'Admin', role: 'admin' }, items: [] }, 200)
  await getSaleEntryOptions(customerId)
  expect(request().url.searchParams.get('regionId')).toBe(customerId)
})
