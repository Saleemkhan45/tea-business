import type {
  EntityId,
  InventoryMovement,
  InventoryMovementFilter,
  LowStockItem,
  StockByLocation,
  StockLocation,
  TeaType,
} from '../domain/types'
import { isWithinDateRange } from '../utils/date'
import { roundQuantity } from '../utils/formatters'

export const BUSINESS_TEA_TYPES: readonly TeaType[] = ['green', 'black']

export function getCurrentStock(locationId: EntityId, teaType: TeaType, movements: readonly InventoryMovement[]): number {
  const total = movements.reduce((stock, movement) => {
    if (movement.stockLocationId !== locationId || movement.teaType !== teaType) return stock
    return stock + movement.quantityDeltaKg
  }, 0)
  return roundQuantity(total)
}

export function getStockByLocation(locationId: EntityId, movements: readonly InventoryMovement[]): StockByLocation {
  const greenKg = getCurrentStock(locationId, 'green', movements)
  const blackKg = getCurrentStock(locationId, 'black', movements)
  return { locationId, greenKg, blackKg, totalKg: roundQuantity(greenKg + blackKg) }
}

export function getStockByTeaType(teaType: TeaType, movements: readonly InventoryMovement[]): number {
  const total = movements.reduce((stock, movement) => movement.teaType === teaType ? stock + movement.quantityDeltaKg : stock, 0)
  return roundQuantity(total)
}

export function getTotalStock(movements: readonly InventoryMovement[]): number {
  return roundQuantity(movements.reduce((stock, movement) => stock + movement.quantityDeltaKg, 0))
}

export function getLowStockItems(locations: readonly StockLocation[], movements: readonly InventoryMovement[]): LowStockItem[] {
  return locations
    .filter(location => location.status === 'active')
    .flatMap(location => BUSINESS_TEA_TYPES.map(teaType => {
      const currentStockKg = getCurrentStock(location.id, teaType, movements)
      return {
        locationId: location.id,
        teaType,
        currentStockKg,
        thresholdKg: location.lowStockThresholdKg,
        status: currentStockKg <= 0 ? 'out_of_stock' as const : 'low_stock' as const,
      }
    }))
    .filter(item => item.currentStockKg <= item.thresholdKg)
}

export function getInventoryMovements(
  movements: readonly InventoryMovement[],
  filter: InventoryMovementFilter = {},
): InventoryMovement[] {
  return movements
    .filter(movement => {
      if (filter.locationId && movement.stockLocationId !== filter.locationId) return false
      if (filter.teaType && movement.teaType !== filter.teaType) return false
      if (filter.type && movement.type !== filter.type) return false
      if (filter.sourceType && movement.sourceType !== filter.sourceType) return false
      if (filter.sourceId && movement.sourceId !== filter.sourceId) return false
      if (filter.dateRange && !isWithinDateRange(movement.businessDate, filter.dateRange)) return false
      return true
    })
    .sort((first, second) => second.businessDate.localeCompare(first.businessDate) || second.createdAt.localeCompare(first.createdAt))
}
