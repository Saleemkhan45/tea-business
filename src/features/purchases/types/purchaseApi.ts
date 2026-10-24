import { z } from 'zod'

export const purchaseDtoSchema = z.object({
  _id: z.string(), supplier: z.string(), item: z.string(), businessDate: z.string(), quantityKg: z.number(), totalAmount: z.number(),
  status: z.enum(['received', 'pending', 'in_transit', 'voided']), receivingRegion: z.string().optional(), regionName: z.string().optional(),
  productName: z.string().optional(), supplierName: z.string().optional(), unitCost: z.number().optional(),
  taxAmount: z.number().optional(), discountAmount: z.number().optional(), shippingAmount: z.number().optional(),
  notes: z.string().optional(), reference: z.string().optional(), createdBy: z.string().optional(), receivedAt: z.string().optional(),
  paidAmount: z.number(), voidReason: z.string().optional(),
  payments: z.array(z.object({ amountPkr: z.number(), method: z.string(), businessDate: z.string(), createdBy: z.string(), reference: z.string().optional() })).optional(),
})
export type PurchaseDto = z.infer<typeof purchaseDtoSchema>
export type PurchasePaymentInput = { amountPkr: number; method: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'; businessDate: string; reference?: string; idempotencyKey: string }
export type PurchaseWriteInput = {
  supplier: string; item: string; receivingRegion: string; businessDate: string; quantityKg: number; unitCost: number;
  taxAmount?: number; shippingAmount?: number; discountAmount?: number; notes?: string; reference?: string;
  status: 'received' | 'pending' | 'in_transit'; payment?: PurchasePaymentInput; idempotencyKey: string;
}
