import { purchasesMockData } from '../data/mockData'
import type { PurchaseRecord } from '../types/purchases'

let purchaseRecords = purchasesMockData.map(record => ({ ...record }))

export function getPurchases(): PurchaseRecord[] {
  return purchaseRecords.map(record => ({ ...record }))
}

export function setPurchaseRecords(records: PurchaseRecord[]) {
  purchaseRecords = records.map(record => ({ ...record }))
}
