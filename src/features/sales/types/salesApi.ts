import { z } from 'zod'

export const saleTeaTypeSchema = z.enum(['green', 'black', 'jasmine', 'herbal', 'other'])
export const salePaymentMethodSchema = z.enum(['cash', 'credit', 'bank_transfer', 'card', 'cheque', 'other'])
export const saleStatusSchema = z.enum(['completed', 'pending', 'voided'])

const saleFields = {
  salespersonName: z.string().nullable().optional(),
  customer: z.string().optional(),
  customerName: z.string().optional(),
  businessDate: z.string(),
  teaType: saleTeaTypeSchema.optional(),
  stockLocationId: z.string().optional(),
  sellingRegion: z.string().optional(),
  sellingRegionName: z.string().optional(),
  product: z.string().optional(),
  quantityKg: z.number().optional(),
  unitPrice: z.number().optional(),
  totalAmount: z.number(),
  amountPaid: z.number().optional(),
  receivedPaymentMethod: salePaymentMethodSchema.optional(),
  productName: z.string().optional(),
  customerRegion: z.string().optional(),
  enteredByName: z.string().nullable().optional(),
  ledgerRecorded: z.boolean().optional(),
  status: saleStatusSchema,
  paymentMethod: salePaymentMethodSchema.optional(),
  createdBy: z.string().optional(),
  notes: z.string().nullable().optional(),
}

export const saleDtoSchema = z.object({
  ...saleFields,
  _id: z.string(),
  shop: z.string(),
  inventoryMovements: z.array(z.object({
    item: z.string(),
    type: z.enum(['sale_decrease', 'sale_restore', 'sale_update_adjustment']),
    quantityKg: z.number(),
    stockBeforeKg: z.number(),
    stockAfterKg: z.number(),
    createdBy: z.string(),
    reason: z.string().optional(),
    createdAt: z.string(),
  })),
  editHistory: z.array(z.object({
    ...saleFields,
    businessDate: z.string().optional(),
    totalAmount: z.number().optional(),
    status: z.string().optional(),
    teaType: z.string().optional(),
    paymentMethod: z.string().optional(),
    changedBy: z.string(),
    createdAt: z.string(),
  })),
  voidedAt: z.string().optional(),
  voidedBy: z.string().optional(),
  voidReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  __v: z.number().optional(),
})

export type SaleDto = z.infer<typeof saleDtoSchema>
export type SalePaymentMethod = z.infer<typeof salePaymentMethodSchema>
export type NewSaleCustomerInput = {
  name: string
  phone?: string
  address?: string
  region?: string
  city?: string
  notes?: string
  openingBalancePkr?: number
}
export type SaleWriteInput = {
  salespersonName?: string | null
  customerId?: string
  customer?: string
  customerName?: string
  newCustomer?: NewSaleCustomerInput
  businessDate: string
  teaType: z.infer<typeof saleTeaTypeSchema>
  stockLocationId: string
  sellingRegion?: string
  quantityKg: number
  unitPrice: number
  amountPaid?: number
  receivedPaymentMethod?: Exclude<SalePaymentMethod, 'credit'>
  paymentMethod?: SalePaymentMethod
  status?: 'completed' | 'pending'
  notes?: string | null
}

export const saleEntryOptionsSchema = z.object({
  operator: z.object({ id: z.string(), name: z.string(), role: z.string() }),
  inventorySummary: z.object({
    totalItems: z.number().int().nonnegative(),
    activeItems: z.number().int().nonnegative(),
    inactiveItems: z.number().int().nonnegative(),
    sellableItems: z.number().int().nonnegative(),
    outOfStockItems: z.number().int().nonnegative(),
  }).optional(),
  items: z.array(z.object({
    id: z.string(),
    itemId: z.string().optional(),
    regionId: z.string().optional(),
    name: z.string(),
    teaType: saleTeaTypeSchema,
    availableKg: z.number(),
    sellingPrice: z.number().nullable(),
    lowStockThreshold: z.number().nonnegative().nullable(),
    updatedAt: z.string().nullable(),
  })),
})
export type SaleStockItem = z.infer<typeof saleEntryOptionsSchema>['items'][number]
export const salesSummarySchema = z.object({ summary: z.object({
  date: z.string(), salesPkr: z.number(), greenKg: z.number(), blackKg: z.number(),
  transactions: z.number(), khataPkr: z.number(), cashReceivedPkr: z.number(), outstandingPkr: z.number(),
}) })
export type CreateSaleInput = SaleWriteInput & { idempotencyKey: string }
export type UpdateSaleInput = Partial<Omit<SaleWriteInput, 'newCustomer'>>
export type SalesQuery = {
  from?: string
  to?: string
  customerId?: string
  status?: z.infer<typeof saleStatusSchema>
  paymentMethod?: SalePaymentMethod
}

export type TopProductsFilters = { from: string; to: string; regionId?: string }
export const topProductsResponseSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  regionId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable(),
  products: z.array(z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    name: z.string().trim().min(1).max(160),
    quantityKg: z.number().finite().positive(),
  })).max(5),
})
export type TopProductsResponse = z.infer<typeof topProductsResponseSchema>
