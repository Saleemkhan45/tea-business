import type { SaleDto } from '../sales/types/salesApi'
import { toSaleRecord } from '../sales/types/sales'
import type { SalesReportRecord } from './types/reports'

export function toSalesReportRecord(sale: SaleDto): SalesReportRecord {
  const record = toSaleRecord(sale)
  return {
    id: record.id,
    date: record.date,
    category: record.teaType === 'Herbal Blend' ? 'Herbal Tea' : record.teaType,
    region: record.region,
    regionId: sale.sellingRegion,
    itemsSold: record.quantityKg,
    totalOrders: 1,
    grandTotal: record.totalAmount,
    status: record.status,
    soldBy: record.soldBy,
    enteredBy: record.enteredBy,
  }
}
