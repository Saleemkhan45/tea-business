import { z } from 'zod'
import { isValidBusinessDate } from '../../business/utils/date'
import type { PurchaseWriteInput } from './types/purchaseApi'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const amount = z.number().int().safe().nonnegative()
export const purchaseFormSchema = z.object({
  supplier: id, item: id, receivingRegion: id,
  businessDate: z.string().refine(isValidBusinessDate),
  quantityKg: z.number().positive().refine(value => Number.isSafeInteger(Math.round(value * 1000)) && Math.abs(value - Math.round(value * 1000) / 1000) < 1e-9),
  unitCost: amount, taxAmount: amount, shippingAmount: amount, discountAmount: amount,
  status: z.enum(['received', 'pending', 'in_transit']), notes: z.string().trim().max(1000), reference: z.string().trim().max(160),
})
export function purchasePreview(input: Pick<PurchaseWriteInput, 'quantityKg' | 'unitCost' | 'taxAmount' | 'shippingAmount' | 'discountAmount'>) {
  const subtotal = Math.round(input.quantityKg * 1000) * input.unitCost
  const total = subtotal / 1000 + (input.taxAmount ?? 0) + (input.shippingAmount ?? 0) - (input.discountAmount ?? 0)
  return Number.isSafeInteger(subtotal) && subtotal % 1000 === 0 && Number.isSafeInteger(total) && total >= 0 ? total : undefined
}
