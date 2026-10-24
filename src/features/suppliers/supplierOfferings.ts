import { z } from 'zod'

const offeringsSchema = z.array(z.string().trim().min(1, 'Enter a product name or remove the empty row.').max(160, 'Use at most 160 characters per product.').transform(value => value.replace(/\s+/g, ' ')))
  .max(100, 'Use at most 100 product offerings.')
  .refine(rows => new Set(rows.map(row => row.toLowerCase())).size === rows.length, 'Each product name must be unique within this supplier.')

export function normalizeSupplierOfferings(rows: string[]) {
  return offeringsSchema.safeParse(rows.length === 1 && !rows[0].trim() ? [] : rows)
}
