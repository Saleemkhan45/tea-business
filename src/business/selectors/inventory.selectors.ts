import type { BusinessData, EntityId, InventoryMovementFilter, TeaType } from '../domain/types'
import {
  getCurrentStock,
  getInventoryMovements,
  getLowStockItems,
  getStockByLocation,
  getStockByTeaType,
  getTotalStock,
} from '../services/inventory.service'

export const selectCurrentStock = (state: BusinessData, locationId: EntityId, teaType: TeaType) =>
  getCurrentStock(locationId, teaType, state.inventoryMovements)

export const selectStockByLocation = (state: BusinessData, locationId: EntityId) =>
  getStockByLocation(locationId, state.inventoryMovements)

export const selectStockByTeaType = (state: BusinessData, teaType: TeaType) =>
  getStockByTeaType(teaType, state.inventoryMovements)

export const selectTotalStock = (state: BusinessData) => getTotalStock(state.inventoryMovements)

export const selectLowStockItems = (state: BusinessData) => getLowStockItems(state.locations, state.inventoryMovements)

export const selectInventoryMovements = (state: BusinessData, filter: InventoryMovementFilter = {}) =>
  getInventoryMovements(state.inventoryMovements, filter)
