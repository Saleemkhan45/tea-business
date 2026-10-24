import { inventoryMockData } from '../data/mockData'
import type { InventoryRecord } from '../types/inventory'

export function getInventory(): InventoryRecord[] {
  return inventoryMockData
}
