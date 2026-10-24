export const INVENTORY_REGIONS = ['Islamabad', 'Lahore', 'Peshawar', 'Karachi', 'Rawalpindi'] as const
export const INVENTORY_TEA_TYPES = ['Green Tea', 'Black Tea'] as const
export const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'] as const

export type InventoryRegion = (typeof INVENTORY_REGIONS)[number]
export type InventoryTeaType = (typeof INVENTORY_TEA_TYPES)[number]
export type StockStatus = (typeof STOCK_STATUSES)[number]

export type StockHistoryItem = { date: string; quantity: number; note: string }
export type InventoryRecord = {
  id: string
  teaType: InventoryTeaType
  region: InventoryRegion
  availableStock: number
  reservedStock: number
  averageCost: number
  stockStatus: StockStatus
  lastUpdated: string
  capacity: number
  purchaseHistory: StockHistoryItem[]
  salesHistory: StockHistoryItem[]
}
export type InventoryFilters = { region: InventoryRegion | ''; teaType: InventoryTeaType | ''; status: StockStatus | '' }
