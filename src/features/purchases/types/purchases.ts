export const PURCHASE_REGIONS = ['Swat', 'Chitral', 'Peshawar', 'Mansehra', 'Lahore'] as const
export const PURCHASE_SUPPLIERS = ['Mountain Leaf Co.', 'Chitral Harvest', 'Frontier Tea Estate', 'Mansehra Organics', 'Lahore Tea Traders'] as const
export const PURCHASE_TEA_TYPES = ['Green Tea', 'Black Tea'] as const
export const PURCHASE_STATUSES = ['Received', 'In Transit', 'Pending'] as const

export type PurchaseRegion = (typeof PURCHASE_REGIONS)[number]
export type PurchaseSupplier = (typeof PURCHASE_SUPPLIERS)[number]
export type PurchaseTeaType = (typeof PURCHASE_TEA_TYPES)[number]
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

export type PurchaseRecord = {
  id: string
  purchaseNumber: number
  date: string
  region: PurchaseRegion
  supplier: PurchaseSupplier
  teaType: PurchaseTeaType
  quantityKg: number
  costPerKg: number
  taxAmount: number
  discountAmount: number
  shippingAmount: number
  totalCost: number
  status: PurchaseStatus
  paidAmount?: number
  paymentMethod?: string
  notes?: string
}

export type PurchaseFilters = {
  date: string
  region: PurchaseRegion | ''
  supplier: PurchaseSupplier | ''
  teaType: PurchaseTeaType | ''
  status: PurchaseStatus | ''
}
