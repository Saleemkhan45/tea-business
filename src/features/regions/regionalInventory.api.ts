import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
import { useAuthStore } from '../auth/auth.store'
import { scopedKey, useScopedQueryKey } from '../auth/queryScope'

export const regionSchema = z.object({ _id: z.string(), name: z.string(), city: z.string().optional(), manager: z.string().optional(), description: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), status: z.enum(['active', 'inactive']) })
export type LiveRegion = z.infer<typeof regionSchema>
export const productSchema = z.object({ _id: z.string(), name: z.string(), teaType: z.string(), status: z.string(), sellingPrice: z.number().nullable().optional(), lowStockThreshold: z.number().nullable().optional() })
export type CatalogProduct = z.infer<typeof productSchema>
export const stockSchema = z.object({ id: z.string(), itemId: z.string(), regionId: z.string(), regionName: z.string(), name: z.string(), teaType: z.string(), availableKg: z.number(), sellingPrice: z.number().nullable(), lowStockThreshold: z.number().nullable().optional(), sellingPriceOverride: z.number().nullable().optional(), lowStockThresholdOverride: z.number().nullable().optional(), catalogSellingPrice: z.number().nullable().optional(), catalogLowStockThreshold: z.number().nullable().optional(), status: z.enum(['available', 'out_of_stock', 'inactive']), updatedAt: z.string() })
export type RegionalInventoryRow = z.infer<typeof stockSchema>
const historySchema = z.object({
  operations: z.array(z.object({ _id: z.string(), type: z.string(), item: z.string(), region: z.string(), destination: z.string().optional(), quantityGrams: z.number(), reason: z.string(), createdBy: z.string(), createdAt: z.string() })),
  sales: z.array(z.object({ _id: z.string(), businessDate: z.string(), productName: z.string().optional(), quantityKg: z.number(), totalAmount: z.number(), status: z.string(), inventoryMovements: z.array(z.object({ type: z.string(), quantityKg: z.number(), stockBeforeKg: z.number(), stockAfterKg: z.number(), createdBy: z.string(), createdAt: z.string() })) })),
})

export async function regionalRequest(path: string, body?: object, method = body ? 'POST' : 'GET', signal?: AbortSignal): Promise<unknown> {
  const response = await authenticatedFetch(`${API_BASE_URL}/regional${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(signal ? { signal } : {}), ...(body ? { body: JSON.stringify(body) } : {}) })
  const data: unknown = await response.json()
  if (!response.ok) {
    const error = z.object({ message: z.string().optional() }).safeParse(data)
    throw Object.assign(new Error(error.success ? error.data.message ?? 'Regional inventory request failed.' : 'Regional inventory request failed.'), { status: response.status })
  }
  return data
}
export function useRegions(enabled = true) {
  const user = useAuthStore(state => state.session?.user)
  return useQuery({ queryKey: scopedKey(['regional', 'regions'], user), enabled, queryFn: async ({ signal }) => z.object({ regions: z.array(regionSchema) }).parse(await regionalRequest('/regions', undefined, 'GET', signal)).regions })
}
export function useProducts() {
  return useQuery({ queryKey: ['regional', 'products'], queryFn: async () => z.object({ products: z.array(productSchema) }).parse(await regionalRequest('/products')).products })
}
export function useRegionalInventory(regionId = '', enabled = true) {
  return useQuery({ queryKey: useScopedQueryKey(['regional', 'inventory', regionId]), enabled, queryFn: async () => z.object({ inventory: z.array(stockSchema) }).parse(await regionalRequest(`/inventory${regionId ? `?regionId=${encodeURIComponent(regionId)}` : ''}`)).inventory, refetchOnMount: 'always' })
}
export function useRegionHistory(regionId: string) {
  return useQuery({ queryKey: useScopedQueryKey(['regional', 'history', regionId]), enabled: Boolean(regionId), queryFn: async () => historySchema.parse(await regionalRequest(`/regions/${encodeURIComponent(regionId)}/history`)) })
}
export function filterRegionalInventory(rows: RegionalInventoryRow[], search: string, regionId: string, status: string) {
  return rows.filter(row => row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (!regionId || row.regionId === regionId) && (!status || row.status === status))
}
