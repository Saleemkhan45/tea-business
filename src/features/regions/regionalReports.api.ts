import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { regionalRequest, regionSchema, stockSchema } from './regionalInventory.api'
import { purchaseDtoSchema } from '../purchases/types/purchaseApi'
import { useAuthStore } from '../auth/auth.store'
import { scopedKey } from '../auth/queryScope'

const totals = z.object({ orders: z.number(), quantityKg: z.number(), salesPkr: z.number(), cashSalesPkr: z.number(), creditSalesPkr: z.number(), paymentsPkr: z.number() })
export const regionOverviewSchema = z.object({ regions: z.array(regionSchema.extend({ stockKg: z.number(), lowStockProducts: z.number(), orders: z.number(), quantityKg: z.number(), salesPkr: z.number() })) })
const movement = z.object({ id: z.string(), date: z.string(), businessDate: z.string().optional(), regionId: z.string(), itemId: z.string(), productName: z.string().optional(), type: z.string(), quantityChangeKg: z.number(), balanceAfterKg: z.number(), reference: z.string(), performedBy: z.string(), reason: z.string().optional() })
const reportSale = z.object({ _id: z.string(), businessDate: z.string(), customerName: z.string().optional(), productName: z.string().optional(), quantityKg: z.number().optional(), unitPrice: z.number().optional(), totalAmount: z.number(), status: z.string(), salespersonName: z.string().nullable().optional(), recordedByName: z.string(), recordedPaidPkr: z.number(), saleLinkedDuePkr: z.number().nullable() })
const group = totals.extend({ name: z.string() })
export type RegionSalesRow = z.infer<typeof reportSale>
export type RegionMovement = z.infer<typeof movement>
export const regionReportSchema = z.object({
  region: regionSchema, summary: totals.extend({ stockKg: z.number(), purchasedKg: z.number(), lowStockProducts: z.number(), outstandingKhataPkr: z.null(), accountingNote: z.string() }),
  inventory: z.array(stockSchema), purchases: z.array(purchaseDtoSchema), sales: z.array(reportSale),
  movements: z.array(movement), products: z.array(group), daily: z.array(group), salespeople: z.array(group),
})
export type RegionReport = z.infer<typeof regionReportSchema>
function queryString(from: string, to: string, itemId = '') {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  if (itemId) query.set('itemId', itemId)
  return query.size ? `?${query}` : ''
}
export function useRegionalOverview(from = '', to = '') {
  const user = useAuthStore(state => state.session?.user)
  return useQuery({ queryKey: scopedKey(['regional', 'overview', from, to], user), queryFn: async ({ signal }) => regionOverviewSchema.parse(await regionalRequest(`/overview${queryString(from, to)}`, undefined, 'GET', signal)).regions })
}
export function useRegionReport(regionId: string, from = '', to = '', itemId = '', enabled = true) {
  const user = useAuthStore(state => state.session?.user)
  return useQuery({ queryKey: scopedKey(['regional', 'report', regionId, from, to, itemId], user), enabled: enabled && Boolean(regionId) && (!from || !to || from <= to), queryFn: async ({ signal }) => regionReportSchema.parse(await regionalRequest(`/regions/${encodeURIComponent(regionId)}/report${queryString(from, to, itemId)}`, undefined, 'GET', signal)) })
}
