import type { BusinessData, DateRange, InventoryMovementFilter } from '../domain/types'
import { getPurchasesByRegion, getPurchasesByTeaType, getSalesByRegion, getSalesByTeaType } from '../services/analytics.service'
import { getInventoryMovements } from '../services/inventory.service'
import { isWithinDateRange } from '../utils/date'

export function selectSalesReport(state: BusinessData, dateRange?: DateRange) {
  const locations = new Map(state.locations.map(location => [location.id, location]))
  const regions = new Map(state.regions.map(region => [region.id, region]))
  return state.sales
    .filter(sale => sale.status === 'completed' && (!dateRange || isWithinDateRange(sale.businessDate, dateRange)))
    .map(sale => {
      const location = locations.get(sale.stockLocationId)
      return {
        ...sale,
        locationName: location?.name ?? 'Unknown location',
        regionName: regions.get(location?.regionId ?? '')?.name ?? 'Unknown region',
      }
    })
    .sort((first, second) => second.businessDate.localeCompare(first.businessDate))
}

export function selectPurchasesReport(state: BusinessData, dateRange?: DateRange) {
  const locations = new Map(state.locations.map(location => [location.id, location.name]))
  const regions = new Map(state.regions.map(region => [region.id, region.name]))
  const suppliers = new Map(state.suppliers.map(supplier => [supplier.id, supplier.name]))
  return state.purchases
    .filter(purchase => purchase.status === 'completed' && (!dateRange || isWithinDateRange(purchase.businessDate, dateRange)))
    .map(purchase => ({
      ...purchase,
      sourceRegionName: regions.get(purchase.sourceRegionId) ?? 'Unknown region',
      destinationLocationName: locations.get(purchase.destinationLocationId) ?? 'Unknown location',
      supplierName: suppliers.get(purchase.supplierId) ?? 'Unknown supplier',
    }))
    .sort((first, second) => second.businessDate.localeCompare(first.businessDate))
}

export function selectInventoryMovementReport(state: BusinessData, filter: InventoryMovementFilter = {}) {
  const locations = new Map(state.locations.map(location => [location.id, location.name]))
  return getInventoryMovements(state.inventoryMovements, filter).map(movement => ({
    ...movement,
    locationName: locations.get(movement.stockLocationId) ?? 'Unknown location',
  }))
}

export function selectRegionalReport(state: BusinessData, dateRange?: DateRange) {
  const sales = getSalesByRegion(state.sales, state.locations, state.regions, dateRange)
  const purchases = getPurchasesByRegion(state.purchases, state.locations, state.regions, 'destination', dateRange)
  const purchaseMap = new Map(purchases.map(metric => [metric.regionId, metric]))
  return sales.map(metric => ({
    regionId: metric.regionId,
    regionName: metric.regionName,
    salesAmount: metric.amount,
    salesQuantityKg: metric.quantityKg,
    salesCount: metric.transactionCount,
    purchaseAmount: purchaseMap.get(metric.regionId)?.amount ?? 0,
    purchasedQuantityKg: purchaseMap.get(metric.regionId)?.quantityKg ?? 0,
    purchaseCount: purchaseMap.get(metric.regionId)?.transactionCount ?? 0,
  }))
}

export function selectTeaPerformanceReport(state: BusinessData, dateRange?: DateRange) {
  const sales = getSalesByTeaType(state.sales, dateRange)
  const purchases = new Map(getPurchasesByTeaType(state.purchases, dateRange).map(metric => [metric.teaType, metric]))
  return sales.map(metric => ({
    teaType: metric.teaType,
    soldQuantityKg: metric.quantityKg,
    salesRevenue: metric.amount,
    salesCount: metric.transactionCount,
    purchasedQuantityKg: purchases.get(metric.teaType)?.quantityKg ?? 0,
    purchaseCost: purchases.get(metric.teaType)?.amount ?? 0,
    purchaseCount: purchases.get(metric.teaType)?.transactionCount ?? 0,
  }))
}
