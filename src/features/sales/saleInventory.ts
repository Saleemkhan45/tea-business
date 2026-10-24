import { formatPKR } from '../../business/utils/formatters'
import type { SelectMenuOption } from '../../components/shared'
import type { SaleStockItem } from './types/salesApi'

export type InventorySummary = {
  totalItems: number
  activeItems: number
  inactiveItems: number
  sellableItems: number
  outOfStockItems: number
}

export function inventorySummary(items: SaleStockItem[], summary?: InventorySummary): InventorySummary {
  return summary ?? {
    totalItems: items.length,
    activeItems: items.length,
    inactiveItems: 0,
    sellableItems: items.filter(item => item.availableKg > 0).length,
    outOfStockItems: items.filter(item => item.availableKg <= 0).length,
  }
}

export function inventoryMatchesSearch(item: SaleStockItem, search: string) {
  const query = search.trim().toLocaleLowerCase()
  return !query || `${item.name} ${item.teaType}`.toLocaleLowerCase().includes(query)
}

export function saleInventoryOptions(items: SaleStockItem[], search: string, selectedId: string): Array<SelectMenuOption<string>> {
  const options = items
    .filter(item => item.id === selectedId || inventoryMatchesSearch(item, search))
    .map(item => ({
      value: item.id,
      label: `${item.name} · ${item.availableKg.toLocaleString('en-PK')} kg · ${item.sellingPrice === null ? 'Price not set' : `${formatPKR(item.sellingPrice)}/kg`}${item.availableKg <= 0 ? ' · Out of stock' : ''}`,
      disabled: item.availableKg <= 0,
    }))
  return [{ value: '', label: 'Select inventory item' }, ...options]
}

export function inventoryCatalogMessage(
  items: SaleStockItem[],
  summary: InventorySummary | undefined,
  search: string,
) {
  const counts = inventorySummary(items, summary)
  if (counts.totalItems === 0) return 'No inventory products have been added yet.'
  if (counts.activeItems === 0) return 'No active products available for sale.'
  if (counts.sellableItems === 0) return 'All active products are currently out of stock.'
  if (!items.some(item => inventoryMatchesSearch(item, search))) return 'No products match your search.'
  return undefined
}
