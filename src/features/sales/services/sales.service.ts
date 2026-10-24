import { z } from 'zod'
import { API_BASE_URL, authenticatedFetch } from '../../auth/auth.api'
import { saleDtoSchema, saleEntryOptionsSchema, salesSummarySchema, topProductsResponseSchema } from '../types/salesApi'
import type { CreateSaleInput, SalesQuery, TopProductsFilters, UpdateSaleInput } from '../types/salesApi'

const errorSchema = z.object({
  message: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})
const saleResponseSchema = z.object({ sale: saleDtoSchema })

export class SalesApiError extends Error {
  readonly status: number
  readonly issues?: Array<{ path: string; message: string }>

  constructor(message: string, status: number, issues?: Array<{ path: string; message: string }>) {
    super(message)
    this.name = 'SalesApiError'
    this.status = status
    this.issues = issues
  }
}

export function getSalesErrorMessage(error: unknown): string {
  if (!(error instanceof SalesApiError)) return 'Unable to complete the sale request. Please try again.'
  if (error.status === 0) return 'Unable to connect. Check your connection and try again.'
  if (error.status === 401) return 'Your session has expired. Sign in again.'
  if (error.status === 408) return 'The request timed out. Retry the same sale request; do not submit a new sale.'
  if (error.status === 403) return 'You do not have permission to change this sale.'
  if (error.status >= 500) return 'Sales are temporarily unavailable. Please try again.'
  if (error.status === 409 && error.message.startsWith('Sale cancellation would create a negative customer balance.')) {
    return "Cannot cancel this sale because later customer payments affect the current Khata balance. Review the customer's ledger first."
  }
  if (error.message === 'Insufficient stock for sale.') return 'Stock availability has changed. Refresh inventory and check the available quantity.'
  if (error.message === 'Customer not found.' || error.message === 'Customer is inactive.') return 'This customer is unavailable. Select an active customer.'
  return error.message || 'The sale request could not be completed.'
}

// Keep transport feature-local, like the existing ledger and notification APIs.
async function salesRequest(path: string, method = 'GET', body?: object, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await authenticatedFetch(`${API_BASE_URL}/sales${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0
    if (error instanceof Error && 'kind' in error && ['authorization', 'rate-limit'].includes(String(error.kind))) throw new SalesApiError(error.message, status)
    throw new SalesApiError(getSalesErrorMessage(new SalesApiError('', status)), status)
  }
  if (!response.ok) {
    if (response.status >= 500) throw new SalesApiError(getSalesErrorMessage(new SalesApiError('', response.status)), response.status)
    const result = errorSchema.safeParse(await response.json().catch(() => null))
    throw new SalesApiError(
      result.success ? result.data.message ?? response.statusText : response.statusText,
      response.status,
      result.success ? result.data.issues : undefined,
    )
  }
  return response.json()
}

function salePath(saleId: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(saleId)) throw new TypeError('A valid sale ID is required.')
  return `/${encodeURIComponent(saleId)}`
}

function writeFields(input: UpdateSaleInput) {
  return {
    salespersonName: input.salespersonName,
    customerId: input.customerId,
    customer: input.customer,
    customerName: input.customerName,
    businessDate: input.businessDate,
    teaType: input.teaType,
    stockLocationId: input.stockLocationId,
    sellingRegion: input.sellingRegion,
    quantityKg: input.quantityKg,
    unitPrice: input.unitPrice,
    amountPaid: input.amountPaid,
    receivedPaymentMethod: input.receivedPaymentMethod,
    paymentMethod: input.paymentMethod,
    status: input.status,
    notes: input.notes,
  }
}

export async function getSales(filters: SalesQuery = {}) {
  const query = new URLSearchParams()
  for (const field of ['from', 'to', 'customerId', 'status', 'paymentMethod'] as const) {
    const value = filters[field]
    if (value !== undefined) query.set(field, value)
  }
  const suffix = query.size ? `?${query}` : ''
  return z.object({ sales: z.array(saleDtoSchema) }).parse(await salesRequest(suffix))
}

export async function getSaleEntryOptions(regionId?: string) {
  return saleEntryOptionsSchema.parse(await salesRequest(`/entry-options${regionId ? `?regionId=${encodeURIComponent(regionId)}` : ''}`))
}

export async function getSaleById(id: string, signal?: AbortSignal) {
  return saleResponseSchema.parse(await salesRequest(salePath(id), 'GET', undefined, signal)).sale
}

export async function getSalesSummary(date: string) {
  return salesSummarySchema.parse(await salesRequest(`/summary?from=${encodeURIComponent(date)}`))
}

export async function getTopSellingProducts(filters: TopProductsFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.regionId) query.set('regionId', filters.regionId)
  return topProductsResponseSchema.parse(await salesRequest(`/top-products?${query}`, 'GET', undefined, signal))
}

export async function createSale(input: CreateSaleInput) {
  return saleResponseSchema.parse(await salesRequest('', 'POST', {
    ...writeFields(input),
    newCustomer: input.newCustomer,
    idempotencyKey: input.idempotencyKey,
  }))
}

export async function updateSale(saleId: string, input: UpdateSaleInput) {
  return saleResponseSchema.parse(await salesRequest(salePath(saleId), 'PATCH', writeFields(input)))
}

export async function voidSale(saleId: string, reason: string) {
  return saleResponseSchema.parse(await salesRequest(`${salePath(saleId)}/void`, 'PATCH', { reason }))
}
