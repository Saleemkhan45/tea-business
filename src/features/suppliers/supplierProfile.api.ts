import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { supplierRequest, useSupplierScope } from './supplier.api'

export type ProfileTab = 'overview' | 'purchases' | 'payments' | 'movements' | 'activity' | 'analytics'
const row = z.object({
  _id: z.string().optional(), purchaseId: z.string().optional(), businessDate: z.string().optional(), reference: z.string().optional(), productName: z.string().optional(),
  quantityKg: z.number().optional(), unitCost: z.number().optional(), totalAmount: z.number().optional(), regionName: z.string().optional(), receivingRegion: z.string().optional(), region: z.string().optional(),
  status: z.string().optional(), invoiceStatus: z.string().optional(), date: z.string().optional(), createdAt: z.string().optional(), amountPkr: z.number().optional(), method: z.string().optional(), paymentReference: z.string().optional(), paymentIndex: z.number().optional(),
  operatorName: z.string().nullable().optional(), type: z.string().optional(), quantityGrams: z.number().optional(), reason: z.string().optional(), action: z.string().optional(), revision: z.number().optional(),
  changes: z.array(z.object({ field: z.string(), previous: z.unknown(), next: z.unknown() })).optional(),
})
const group = z.object({ name: z.string(), count: z.number(), quantityKg: z.number(), valuePkr: z.number() })
const responseSchema = z.object({ rows: z.array(row).default([]), total: z.number().default(0), page: z.number().default(1), limit: z.number().default(10), products: z.array(group).default([]), regions: z.array(group).default([]), trend: z.array(group).default([]) })
export type SupplierHistoryRow = z.infer<typeof row>
export function useSupplierHistory(id: string, tab: ProfileTab, filters: Record<string, string>) {
  const scope = useSupplierScope()
  const params = new URLSearchParams({ ...filters, tab }).toString()
  return useQuery({ queryKey: ['suppliers', 'history', id, params, scope], enabled: tab !== 'overview', retry: false, staleTime: 30000,
    queryFn: async ({ signal }) => responseSchema.parse(await supplierRequest(`/${encodeURIComponent(id)}/history?${params}`, undefined, 'GET', signal)) })
}
