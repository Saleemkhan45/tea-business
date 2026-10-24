import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
import { useAuthStore } from '../auth/auth.store'

export const supplierSchema = z.object({
  createdAt: z.string().optional(), updatedAt: z.string().optional(),
  _id: z.string(), name: z.string(), phone: z.string().default(''), alternatePhone: z.string().default(''),
  contactPerson: z.string().default(''), email: z.string().default(''), city: z.string().default(''),
  address: z.string().default(''), notes: z.string().default(''), status: z.enum(['active', 'inactive']),
  regions: z.array(z.string()).default([]), products: z.array(z.string()).default([]), productOfferings: z.array(z.string()).default([]), revision: z.number().default(0),
})
export type LiveSupplier = z.infer<typeof supplierSchema>
export type SupplierInput = Omit<LiveSupplier, '_id' | 'revision' | 'createdAt' | 'updatedAt'>
export class SupplierApiError extends Error {
  readonly code: string
  readonly status: number
  readonly outcomeUncertain: boolean
  readonly existingSupplierId?: string
  readonly issues?: { path: string; message: string }[]
  constructor(message: string, status: number, code: string, details: { outcomeUncertain?: boolean; existingSupplierId?: string; issues?: { path: string; message: string }[] } = {}) {
    super(message); this.name = 'SupplierApiError'; this.status = status; this.code = code
    this.outcomeUncertain = details.outcomeUncertain ?? false
    this.existingSupplierId = details.existingSupplierId; this.issues = details.issues
  }
}
const statsSchema = z.object({ quantityKg: z.number(), valuePkr: z.number(), invoicedPkr: z.number(), unknownPayableCount: z.number(), paymentsPkr: z.number(), outstandingPkr: z.number(), count: z.number(), lastPurchase: z.string().nullable() })
const directorySchema = z.object({ suppliers: z.array(supplierSchema.extend({ stats: statsSchema })), stats: statsSchema })
export async function supplierRequest(path = '', body?: object, method = body ? 'POST' : 'GET', signal?: AbortSignal) {
  const writing = method === 'POST' || method === 'PATCH'
  let response: Response
  try { response = await authenticatedFetch(`${API_BASE_URL}/purchases/suppliers${path}`, { method, ...(signal ? { signal } : {}), headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }) }
  catch (error) {
    if (signal?.aborted) throw error
    // authenticatedFetch can throw after a completed write if the session changed.
    if (error instanceof Error && 'status' in error && error.status === 401) throw new SupplierApiError(writing ? 'Authentication changed. Saving could not be confirmed. Sign in and use the read-only check before another write.' : 'Sign in to continue.', 401, 'AUTHENTICATION_REQUIRED', { outcomeUncertain: writing })
    throw new SupplierApiError(writing ? 'Saving could not be confirmed. Use the read-only check before another write.' : 'Unable to load supplier data.', 0, writing ? 'SUPPLIER_SAVE_FAILED' : 'DATABASE_UNAVAILABLE', { outcomeUncertain: writing })
  }
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = z.object({ message: z.string(), code: z.string().optional(), existingSupplierId: z.string().optional(), outcomeUncertain: z.boolean().optional(), issues: z.array(z.object({ path: z.string(), message: z.string() })).optional() }).safeParse(data)
    const fallback = response.status === 401 ? 'AUTHENTICATION_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'SUPPLIER_SAVE_FAILED'
    throw new SupplierApiError(error.success ? error.data.issues?.map(issue => `${issue.path}: ${issue.message}`).join(' ') || error.data.message : 'Supplier request failed.', response.status, error.success ? error.data.code ?? fallback : fallback, {
      ...(error.success ? error.data : {}), outcomeUncertain: writing && (response.status >= 500 && (!error.success || error.data.code !== 'DATABASE_UNAVAILABLE') || Boolean(error.success && error.data.outcomeUncertain)),
    })
  }
  return data
}
export function useSuppliers(filters: Record<string, string>) {
  const scope = useSupplierScope()
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()
  return useQuery({ queryKey: ['suppliers', query, scope], queryFn: async ({ signal }) => directorySchema.parse(await supplierRequest(`?${query}`, undefined, 'GET', signal)) })
}
export function useSupplierScope() {
  return useAuthStore(state => [state.session?.user.shopId, state.session?.user.id, state.session?.user.role, state.revision].join(':'))
}
export const supplierProfileSchema = z.object({ supplier: supplierSchema, stats: statsSchema, currentStats: statsSchema })
export type SupplierStats = z.infer<typeof statsSchema>
export function useSupplier(id: string, from = '', to = '') {
  const scope = useSupplierScope()
  return useQuery({ queryKey: ['suppliers', 'detail', id, from, to, scope], enabled: Boolean(id), retry: false, staleTime: 30000,
    queryFn: async ({ signal }) => supplierProfileSchema.parse(await supplierRequest(`/${encodeURIComponent(id)}/profile?${new URLSearchParams({ from, to })}`, undefined, 'GET', signal)) })
}
export async function saveSupplier(input: SupplierInput, supplier?: LiveSupplier, creationIdempotencyKey?: string) {
  const result = z.object({ supplier: supplierSchema }).safeParse(await supplierRequest(supplier ? `/${supplier._id}` : '', { ...input, ...(supplier ? { revision: supplier.revision } : { creationIdempotencyKey }) }, supplier ? 'PATCH' : 'POST'))
  if (!result.success) throw new SupplierApiError('The save response could not be verified. Use the read-only check before another write.', 502, 'SUPPLIER_SAVE_FAILED', { outcomeUncertain: true })
  return result.data.supplier
}
export async function reconcileSupplier(key: string) {
  return z.discriminatedUnion('status', [z.object({ status: z.literal('confirmed'), supplier: supplierSchema }), z.object({ status: z.literal('unconfirmed') })]).parse(await supplierRequest(`/reconcile?${new URLSearchParams({ creationIdempotencyKey: key })}`))
}



