import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { API_BASE_URL, authenticatedFetch } from '../../auth/auth.api'
import { useAuthStore } from '../../auth/auth.store'
import { scopedKey } from '../../auth/queryScope'
const amount = z.number().finite()
export const dashboardSchema = z.object({
  from: z.string(), to: z.string(), regionId: z.string().nullable(),
  metrics: z.object({ orders: amount, salesPkr: amount, averageOrderPkr: amount, stockKg: amount, creditSalesPkr: amount }),
  daily: z.array(z.object({ date: z.string(), salesPkr: amount })),
  categories: z.array(z.object({ label: z.string(), orders: amount, percent: amount })),
  recentSales: z.array(z.object({ _id: z.string(), businessDate: z.string(), customerName: z.string().optional(), productName: z.string().optional(), quantityKg: amount.optional(), sellingRegionName: z.string().optional(), totalAmount: amount, paymentMethod: z.string().optional(), status: z.string() })),
  khata: z.object({ outstandingPkr: amount, customers: amount, paymentsTodayPkr: amount, today: z.string() }),
})
export type LiveDashboard = z.infer<typeof dashboardSchema>
export class DashboardApiError extends Error {
  readonly status: number
  readonly kind: 'http' | 'invalid-response'
  constructor(message: string, status: number, kind: DashboardApiError['kind'] = 'http') {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
    this.kind = kind
  }
}

const validationErrorSchema = z.object({ issues: z.array(z.object({ path: z.string() })).optional() })

export async function getDashboardData(filters: { from: string; to: string; regionId?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.regionId) query.set('regionId', filters.regionId)
  const response = await authenticatedFetch(`${API_BASE_URL}/sales/dashboard?${query}`, { signal })
  if (!response.ok) {
    const body = validationErrorSchema.safeParse(await response.json().catch(() => null))
    const fields = body.success ? body.data.issues?.map(issue => issue.path) ?? [] : []
    // An older sales router treats the literal "dashboard" path as /:saleId.
    // Report this contract mismatch without exposing arbitrary server diagnostics.
    if (response.status === 400 && fields.includes('saleId')) {
      throw new DashboardApiError('The running API does not recognize the dashboard route. Restart the backend with the current code, then retry.', 400)
    }
    if (response.status === 400) {
      const rejected = ['from', 'to', 'regionId'].filter(field => fields.includes(field))
      throw new DashboardApiError(`Dashboard request rejected (HTTP 400)${rejected.length ? `: check ${rejected.join(', ')}` : ''}. Please retry after correcting the request.`, 400)
    }
    if (response.status === 401) throw new DashboardApiError('Your session expired. Sign in again.', 401)
    if (response.status === 403) throw new DashboardApiError('You do not have access to this dashboard.', 403)
    if (response.status === 503) throw new DashboardApiError('The business database is temporarily unavailable. Please retry.', 503)
    throw new DashboardApiError(`Dashboard could not be loaded (HTTP ${response.status}). Please retry.`, response.status)
  }
  const result = dashboardSchema.safeParse(await response.json().catch(() => null))
  if (!result.success) throw new DashboardApiError('The dashboard API returned an incompatible response. Check that the frontend and backend are updated together, then retry.', 502, 'invalid-response')
  return result.data
}
export function useDashboard(filters: { from: string; to: string; regionId?: string }) {
  const user = useAuthStore(state => state.session?.user)
  // These roots already participate in sale, purchase, inventory and ledger invalidation.
  return useQuery({ queryKey: scopedKey(['regional', 'dashboard', { ...filters, regionId: filters.regionId || '' }], user), queryFn: ({ signal }) => getDashboardData(filters, signal), enabled: Boolean(user?.shopId) })
}

