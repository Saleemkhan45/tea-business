import { z } from 'zod'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'

export type SearchCategory = 'customers' | 'sales' | 'purchases'
const resultSchema = z.object({ id: z.string(), title: z.string(), reference: z.string().optional(), description: z.string(), date: z.string().optional(), total: z.number().optional(), status: z.string().optional() })
export type SearchResult = z.infer<typeof resultSchema>

export async function searchDashboard(category: SearchCategory, search: string, signal: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({ search, page: '1', limit: '6' })
  const response = await authenticatedFetch(`${API_BASE_URL}/${category}${category === 'customers' ? '' : '/search'}?${params}`, { method: 'GET', signal })
  if (!response.ok) throw new Error(response.status === 403 ? 'You do not have permission to search these records.' : response.status === 401 ? 'Your session expired. Sign in again.' : 'Search is unavailable. Please try again.')
  const data: unknown = await response.json()
  if (category !== 'customers') return z.object({ results: z.array(resultSchema) }).parse(data).results
  return z.object({ customers: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string().optional(), region: z.string().optional(), city: z.string().optional() })) }).parse(data).customers.map(customer => ({
    id: customer.id, title: customer.name, description: [customer.phone, customer.city, customer.region].filter(Boolean).join(' · '),
  }))
}

export function resultPath(category: SearchCategory, id?: string) {
  return id ? category === 'customers' ? `/customers/${encodeURIComponent(id)}` : `/${category}?record=${encodeURIComponent(id)}` : `/${category}`
}
