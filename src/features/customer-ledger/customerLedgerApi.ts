import { z } from 'zod'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
import type { BusinessDate } from '../../business/domain/types'
import type {
  AdjustmentApiResponse,
  CreateAdjustmentInput,
  CreateCustomerInput,
  CreateOpeningBalanceInput,
  CreatePaymentInput,
  CreatePurchaseInput,
  CustomerByIdResponse,
  CustomerDirectoryFilters,
  CustomerDirectoryResponse,
  DailyPaymentsApiResponse,
  LedgerApiResponse,
  LedgerFilters,
  OpeningBalanceApiResponse,
  PaymentApiResponse,
  PaymentCalendarApiResponse,
  PaymentDateRange,
  PaymentInsightsApiResponse,
  PaymentInsightsParams,
  PurchaseApiResponse,
  ReminderCandidateApiResponse,
  SummaryApiResponse,
  VoidApiResponse,
} from './types'


export type CustomerLedgerApiIssue = { path: string; message: string }

export class CustomerLedgerApiError extends Error {
  readonly status: number
  readonly issues?: CustomerLedgerApiIssue[]
  readonly outcomeUncertain: boolean
  readonly authorizationCanceled: boolean

  constructor(
    message: string,
    status: number,
    issues?: CustomerLedgerApiIssue[],
    outcomeUncertain = false,
    authorizationCanceled = false,
  ) {
    super(message)
    this.name = 'CustomerLedgerApiError'
    this.status = status
    this.issues = issues
    this.outcomeUncertain = outcomeUncertain
    this.authorizationCanceled = authorizationCanceled
  }
}

export function definitiveLedgerFailure(error: unknown, previouslyUncertain: boolean) {
  return !previouslyUncertain && error instanceof CustomerLedgerApiError && !error.outcomeUncertain && error.status >= 400 && error.status < 500 && error.status !== 408
}

export function isValidCustomerId(customerId: string | undefined): customerId is string {
  return Boolean(customerId && /^[0-9a-fA-F]{24}$/.test(customerId))
}

export function getCustomerLedgerErrorMessage(error: unknown): string {
  if (error instanceof CustomerLedgerApiError && error.authorizationCanceled) return error.message
  if (isRecord(error) && error.status === 429) return error instanceof Error ? error.message : 'Too many requests. Wait before retrying.'
  const status = isRecord(error) && typeof error.status === 'number' ? error.status : undefined
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 403) return 'You do not have access to this customer account.'
  if (status === 400) return 'The customer ID or request is invalid.'
  if (status === 404) return 'Customer not found in this shop.'
  if (status === 408) return 'The request timed out. Retry the same operation; do not submit a new payment.'
  if (status === 0) return 'Unable to connect. Check your connection and try again.'
  return 'Unable to load account data. Please try again.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function responseError(response: Response): Promise<CustomerLedgerApiError> {
  if (response.status >= 500) {
    return new CustomerLedgerApiError(getCustomerLedgerErrorMessage({ status: response.status }), response.status)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return new CustomerLedgerApiError(response.statusText || 'Customer ledger request failed.', response.status)
  }

  const message = isRecord(payload) && typeof payload.message === 'string'
    ? payload.message
    : response.statusText || 'Customer ledger request failed.'
  const issues = isRecord(payload) && Array.isArray(payload.issues)
    ? payload.issues.filter((issue): issue is CustomerLedgerApiIssue =>
      isRecord(issue) && typeof issue.path === 'string' && typeof issue.message === 'string')
    : undefined
  return new CustomerLedgerApiError(message, response.status, issues)
}

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  let response: Response
  try {
    response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    const status = isRecord(error) && typeof error.status === 'number' ? error.status : 0
    const uncertain = isRecord(error) && error.outcomeUncertain === true
    if (isRecord(error) && error.kind === 'authorization' && error instanceof Error) throw new CustomerLedgerApiError(error.message, status, undefined, false, true)
    if (isRecord(error) && error.kind === 'rate-limit' && error instanceof Error) throw new CustomerLedgerApiError(error.message, status)
    throw new CustomerLedgerApiError(getCustomerLedgerErrorMessage({ status }), status, undefined, uncertain)
  }
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<T>
}

function customerPath(customerId: string): string {
  if (!customerId) throw new TypeError('Customer ID is required.')
  if (!isValidCustomerId(customerId)) throw new TypeError('Customer ID is invalid.')
  return `/customers/${encodeURIComponent(customerId)}`
}

function queryString(entries: Array<[string, string | number | undefined]>): string {
  const params = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.size > 0 ? `?${params.toString()}` : ''
}

function notesField(notes: string | null | undefined) {
  return notes === undefined ? {} : { notes }
}

export function getCustomerById(customerId: string) {
  return request<CustomerByIdResponse>(customerPath(customerId))
}

export function getCustomerLedger(customerId: string, filters: LedgerFilters = {}) {
  // The API returns the full matching history with server-computed running balances; it has no paging contract.
  const query = queryString([
    ['from', filters.from], ['to', filters.to], ['type', filters.type], ['status', filters.status], ['teaType', filters.teaType],
  ])
  return request<LedgerApiResponse>(`${customerPath(customerId)}/ledger${query}`)
}

export function getCustomerDirectory(filters: CustomerDirectoryFilters = {}) {
  const query = queryString([
    ['page', filters.page ?? 1],
    ['limit', filters.limit ?? 20],
    ['search', filters.search?.trim()],
    ['status', filters.status],
  ])
  return request<CustomerDirectoryResponse>(`/customers${query}`)
}

const createdCustomerSchema = z.object({ customer: z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/), name: z.string().min(1),
  phone: z.string(), address: z.string(), status: z.enum(['active', 'inactive']),
  currentBalancePkr: z.number().int().refine(Number.isSafeInteger),
  region: z.string().optional(), city: z.string().optional(), notes: z.string().optional(), createdAt: z.string().optional(),
}) })

export async function createCustomer(input: CreateCustomerInput) {
  const response = await request<unknown>('/customers', 'POST', {
    name: input.name,
    phone: input.phone,
    address: input.address,
    region: input.region,
    city: input.city,
    notes: input.notes,
    openingBalancePkr: input.openingBalancePkr,
    idempotencyKey: input.idempotencyKey,
  })
  const result = createdCustomerSchema.safeParse(response)
  if (!result.success) throw new CustomerLedgerApiError('Customer save could not be confirmed. Check the customer directory before submitting again.', 502)
  return result.data
}

export function deleteCustomer(customerId: string) {
  return request<{ deleted: boolean; id: string }>(customerPath(customerId), 'DELETE')
}

export function getCustomerLedgerSummary(customerId: string, referenceDate?: BusinessDate) {
  return request<SummaryApiResponse>(
    `${customerPath(customerId)}/summary${queryString([['referenceDate', referenceDate]])}`,
  )
}

export function getCustomerLedgerDailyPayments(customerId: string, range: PaymentDateRange) {
  return request<DailyPaymentsApiResponse>(
    `${customerPath(customerId)}/daily-payments${queryString([['from', range.from], ['to', range.to]])}`,
  )
}

export function getCustomerLedgerPaymentInsights(customerId: string, params: PaymentInsightsParams) {
  return request<PaymentInsightsApiResponse>(
    `${customerPath(customerId)}/payment-insights${queryString([
      ['from', params.from], ['to', params.to], ['referenceDate', params.referenceDate],
    ])}`,
  )
}

export function getCustomerLedgerPaymentCalendar(customerId: string, range: PaymentDateRange) {
  return request<PaymentCalendarApiResponse>(
    `${customerPath(customerId)}/payment-calendar${queryString([['from', range.from], ['to', range.to]])}`,
  )
}

export function getCustomerLedgerReminderCandidate(customerId: string, thresholdDays: number, referenceDate?: BusinessDate) {
  return request<ReminderCandidateApiResponse>(
    `${customerPath(customerId)}/reminder-candidate${queryString([
      ['thresholdDays', thresholdDays], ['referenceDate', referenceDate],
    ])}`,
  )
}

export function createCustomerPurchase(customerId: string, input: CreatePurchaseInput) {
  return request<PurchaseApiResponse>(`${customerPath(customerId)}/purchases`, 'POST', {
    businessDate: input.businessDate,
    saleId: input.saleId,
    teaType: input.teaType,
    stockLocationId: input.stockLocationId,
    quantityKg: input.quantityKg,
    ratePerKgPkr: input.ratePerKgPkr,
    ...notesField(input.notes),
  })
}

export function createCustomerPayment(customerId: string, input: CreatePaymentInput) {
  return request<PaymentApiResponse>(`${customerPath(customerId)}/payments`, 'POST', {
    collectionOccurrence: input.collectionOccurrence,
    businessDate: input.businessDate,
    amountPkr: input.amountPkr,
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    idempotencyKey: input.idempotencyKey,
    ...notesField(input.notes),
  })
}

export function createCustomerOpeningBalance(customerId: string, input: CreateOpeningBalanceInput) {
  return request<OpeningBalanceApiResponse>(`${customerPath(customerId)}/opening-balance`, 'POST', {
    businessDate: input.businessDate,
    amountPkr: input.amountPkr,
    ...notesField(input.notes),
  })
}

export function createCustomerAdjustment(customerId: string, input: CreateAdjustmentInput) {
  return request<AdjustmentApiResponse>(`${customerPath(customerId)}/adjustments`, 'POST', {
    businessDate: input.businessDate,
    amountPkr: input.amountPkr,
    reason: input.reason,
    ...notesField(input.notes),
  })
}

export function voidCustomerLedgerTransaction(customerId: string, transactionId: string, reason: string) {
  if (!transactionId) throw new TypeError('Transaction ID is required.')
  return request<VoidApiResponse>(
    `${customerPath(customerId)}/transactions/${encodeURIComponent(transactionId)}/void`,
    'PATCH',
    { reason },
  )
}
