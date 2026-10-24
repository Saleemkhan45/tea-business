import { suppliersMockData } from '../data/mockData'
import type { SupplierRecord } from '../types/suppliers'

export function getSuppliers(): SupplierRecord[] {
  return suppliersMockData
}
