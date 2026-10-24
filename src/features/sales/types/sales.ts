export const SALES_REGIONS = ['Islamabad', 'Lahore', 'Peshawar', 'Karachi', 'Rawalpindi'] as const
export const TEA_TYPES = ['Green Tea', 'Black Tea', 'Jasmine Tea', 'Herbal Blend', 'Other'] as const
export type SalePaymentStatus = 'Paid' | 'Partial' | 'Khata' | 'Cancelled'
export const PAYMENT_STATUS_OPTIONS: SalePaymentStatus[] = ['Paid', 'Partial', 'Khata', 'Cancelled']
import type { SaleDto } from './salesApi'

export const SALE_STATUSES = ['Completed', 'Pending', 'Voided'] as const

export type SalesRegion = (typeof SALES_REGIONS)[number]
export type TeaType = (typeof TEA_TYPES)[number]
export type SaleStatus = (typeof SALE_STATUSES)[number]

export type SaleRecord = {
  id: string
  date: string
  customerName: string
  region: string
  teaType: TeaType | '-'
  quantityKg?: number
  unitPrice?: number
  totalAmount: number
  enteredBy: string
  soldBy?: string
  status: SaleStatus
  paymentStatus?: SalePaymentStatus
  amountPaid?: number
  amountDue?: number
  paymentMethod?: string
  notes?: string
  source?: SaleDto
}

// Display-only adapter for the existing table. These fields are never sent to the API.
export function toSaleRecord(sale: SaleDto): SaleRecord {
  return {
    id: sale._id,
    date: sale.businessDate,
    customerName: sale.customerName || '-',
    region: sale.sellingRegionName || (sale.sellingRegion ? 'Regional sale' : sale.customerRegion) || '-',
    teaType: sale.teaType === 'green' ? 'Green Tea' : sale.teaType === 'black' ? 'Black Tea' : sale.teaType === 'jasmine' ? 'Jasmine Tea' : sale.teaType === 'herbal' ? 'Herbal Blend' : sale.teaType === 'other' ? 'Other' : '-',
    quantityKg: sale.quantityKg,
    unitPrice: sale.unitPrice,
    totalAmount: sale.totalAmount,
    enteredBy: sale.enteredByName ?? '-',
    soldBy: sale.salespersonName ?? undefined,
    amountPaid: sale.amountPaid ?? (sale.paymentMethod === 'credit' ? 0 : sale.totalAmount),
    amountDue: sale.totalAmount - (sale.amountPaid ?? (sale.paymentMethod === 'credit' ? 0 : sale.totalAmount)),
    paymentMethod: sale.paymentMethod === 'credit' ? 'Khata' : sale.paymentMethod?.replace('_', ' ') ?? '-',
    paymentStatus: sale.status === 'voided' ? 'Cancelled' : (sale.amountPaid ?? (sale.paymentMethod === 'credit' ? 0 : sale.totalAmount)) >= sale.totalAmount ? 'Paid' : (sale.amountPaid ?? 0) > 0 ? 'Partial' : 'Khata',
    status: sale.status === 'completed' ? 'Completed' : sale.status === 'pending' ? 'Pending' : 'Voided',
    notes: sale.notes ?? undefined,
    source: sale,
  }
}

export type SaleFilters = {
  date: string
  region: SalesRegion | ''
  teaType: TeaType | ''
  status: SalePaymentStatus | ''
  paymentMethod: string
  operator: string
  customer: string
}
