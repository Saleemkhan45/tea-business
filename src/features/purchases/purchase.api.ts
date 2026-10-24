import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
import { purchaseDtoSchema } from './types/purchaseApi'

export class PurchaseApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.name = 'PurchaseApiError'; this.status = status }
}
export async function purchaseRequest(path: string, body?: object) {
  let response: Response
  try { response = await authenticatedFetch(`${API_BASE_URL}/purchases${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }) }
  catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
    if (error instanceof Error && 'kind' in error && ['authorization', 'rate-limit'].includes(String(error.kind))) throw new PurchaseApiError(error.message, status)
    throw new PurchaseApiError(status === 401 ? 'Your session expired. Sign in again.' : status === 408 ? 'The request timed out. Retry the same operation; do not create a new request.' : 'Unable to connect. Retry the same operation.', status)
  }
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = z.object({ message: z.string().optional(), issues: z.array(z.object({ message: z.string() })).optional() }).safeParse(data)
    throw new PurchaseApiError(error.success ? error.data.issues?.map(issue => issue.message).join(' ') || error.data.message || 'Purchase request failed.' : 'Purchase request failed.', response.status)
  }
  return data
}
export async function writePurchase(path: string, body: object) {
  return z.object({ purchase: purchaseDtoSchema }).parse(await purchaseRequest(path, body)).purchase
}
export function usePurchases(regionId = '') {
  return useQuery({ queryKey: ['purchases', regionId], queryFn: async () => z.object({ purchases: z.array(purchaseDtoSchema) }).parse(await purchaseRequest(regionId ? `?regionId=${encodeURIComponent(regionId)}` : '')).purchases })
}
export function usePurchaseOptions() {
  return useQuery({ queryKey: ['purchases', 'options'], queryFn: async () => z.object({ suppliers: z.array(z.object({ _id: z.string(), name: z.string() })) }).parse(await purchaseRequest('/options')).suppliers })
}
export function useInvalidatePurchases() {
  const client = useQueryClient()
  return () => Promise.all([client.invalidateQueries({ queryKey: ['purchases'] }), client.invalidateQueries({ queryKey: ['regional'] })])
}


