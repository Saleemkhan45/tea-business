import type {
  BusinessData,
  BusinessDate,
  DateRange,
  Purchase,
  Region,
  Sale,
  StockLocation,
  TeaType,
} from '../domain/types'
import { getPakistanBusinessDate, isWithinDateRange } from '../utils/date'
import { roundCurrency, roundQuantity } from '../utils/formatters'
import { getLowStockItems, getStockByTeaType } from './inventory.service'

export type RegionalMetric = {
  regionId: string
  regionName: string
  transactionCount: number
  quantityKg: number
  amount: number
}

export type TeaMetric = {
  teaType: TeaType
  transactionCount: number
  quantityKg: number
  amount: number
}

export type PurchaseRegionDimension = 'source' | 'destination'

function saleIsIncluded(sale: Sale, dateRange?: DateRange) {
  return sale.status === 'completed' && (!dateRange || isWithinDateRange(sale.businessDate, dateRange))
}

function purchaseIsIncluded(purchase: Purchase, dateRange?: DateRange) {
  return purchase.status === 'completed' && (!dateRange || isWithinDateRange(purchase.businessDate, dateRange))
}

function todayRange(businessDate: BusinessDate): DateRange {
  return { startDate: businessDate, endDate: businessDate }
}

export function getTodaySales(sales: readonly Sale[], businessDate = getPakistanBusinessDate()): number {
  return roundCurrency(sales.filter(sale => saleIsIncluded(sale, todayRange(businessDate))).reduce((sum, sale) => sum + sale.totalAmount, 0))
}

export function getTodayPurchases(purchases: readonly Purchase[], businessDate = getPakistanBusinessDate()): number {
  return roundCurrency(purchases.filter(purchase => purchaseIsIncluded(purchase, todayRange(businessDate))).reduce((sum, purchase) => sum + purchase.totalCost, 0))
}

export function getTodayTeaSold(sales: readonly Sale[], businessDate = getPakistanBusinessDate()): number {
  return roundQuantity(sales.filter(sale => saleIsIncluded(sale, todayRange(businessDate))).reduce((sum, sale) => sum + sale.quantityKg, 0))
}

export function getTodayTeaPurchased(purchases: readonly Purchase[], businessDate = getPakistanBusinessDate()): number {
  return roundQuantity(purchases.filter(purchase => purchaseIsIncluded(purchase, todayRange(businessDate))).reduce((sum, purchase) => sum + purchase.quantityKg, 0))
}

export function getTotalGreenTeaStock(state: Pick<BusinessData, 'inventoryMovements'>): number {
  return getStockByTeaType('green', state.inventoryMovements)
}

export function getTotalBlackTeaStock(state: Pick<BusinessData, 'inventoryMovements'>): number {
  return getStockByTeaType('black', state.inventoryMovements)
}

export function getSalesByRegion(
  sales: readonly Sale[],
  locations: readonly StockLocation[],
  regions: readonly Region[],
  dateRange?: DateRange,
): RegionalMetric[] {
  const locationRegion = new Map(locations.map(location => [location.id, location.regionId]))
  const metrics = new Map(regions.map(region => [region.id, {
    regionId: region.id,
    regionName: region.name,
    transactionCount: 0,
    quantityKg: 0,
    amount: 0,
  }]))

  sales.filter(sale => saleIsIncluded(sale, dateRange)).forEach(sale => {
    const regionId = locationRegion.get(sale.stockLocationId)
    const metric = regionId ? metrics.get(regionId) : undefined
    if (!metric) return
    metric.transactionCount += 1
    metric.quantityKg = roundQuantity(metric.quantityKg + sale.quantityKg)
    metric.amount = roundCurrency(metric.amount + sale.totalAmount)
  })
  return [...metrics.values()]
}

export function getPurchasesByRegion(
  purchases: readonly Purchase[],
  locations: readonly StockLocation[],
  regions: readonly Region[],
  dimension: PurchaseRegionDimension = 'source',
  dateRange?: DateRange,
): RegionalMetric[] {
  const locationRegion = new Map(locations.map(location => [location.id, location.regionId]))
  const metrics = new Map(regions.map(region => [region.id, {
    regionId: region.id,
    regionName: region.name,
    transactionCount: 0,
    quantityKg: 0,
    amount: 0,
  }]))

  purchases.filter(purchase => purchaseIsIncluded(purchase, dateRange)).forEach(purchase => {
    const regionId = dimension === 'source'
      ? purchase.sourceRegionId
      : locationRegion.get(purchase.destinationLocationId)
    const metric = regionId ? metrics.get(regionId) : undefined
    if (!metric) return
    metric.transactionCount += 1
    metric.quantityKg = roundQuantity(metric.quantityKg + purchase.quantityKg)
    metric.amount = roundCurrency(metric.amount + purchase.totalCost)
  })
  return [...metrics.values()]
}

export function getSalesByTeaType(sales: readonly Sale[], dateRange?: DateRange): TeaMetric[] {
  return (['green', 'black'] as const).map(teaType => {
    const records = sales.filter(sale => sale.teaType === teaType && saleIsIncluded(sale, dateRange))
    return {
      teaType,
      transactionCount: records.length,
      quantityKg: roundQuantity(records.reduce((sum, sale) => sum + sale.quantityKg, 0)),
      amount: roundCurrency(records.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    }
  })
}

export function getPurchasesByTeaType(purchases: readonly Purchase[], dateRange?: DateRange): TeaMetric[] {
  return (['green', 'black'] as const).map(teaType => {
    const records = purchases.filter(purchase => purchase.teaType === teaType && purchaseIsIncluded(purchase, dateRange))
    return {
      teaType,
      transactionCount: records.length,
      quantityKg: roundQuantity(records.reduce((sum, purchase) => sum + purchase.quantityKg, 0)),
      amount: roundCurrency(records.reduce((sum, purchase) => sum + purchase.totalCost, 0)),
    }
  })
}

export function getTopSellingRegion(
  sales: readonly Sale[],
  locations: readonly StockLocation[],
  regions: readonly Region[],
  dateRange?: DateRange,
): RegionalMetric | null {
  return getSalesByRegion(sales, locations, regions, dateRange)
    .reduce<RegionalMetric | null>((top, current) => !top || current.amount > top.amount ? current : top, null)
}

export function getTopSellingTea(sales: readonly Sale[], dateRange?: DateRange): TeaMetric | null {
  return getSalesByTeaType(sales, dateRange)
    .reduce<TeaMetric | null>((top, current) => !top || current.quantityKg > top.quantityKg ? current : top, null)
}

export function getLowStockCount(state: Pick<BusinessData, 'locations' | 'inventoryMovements'>): number {
  return getLowStockItems(state.locations, state.inventoryMovements).length
}

export function getDashboardAnalytics(state: BusinessData, businessDate = getPakistanBusinessDate()) {
  return {
    todaySales: getTodaySales(state.sales, businessDate),
    todayPurchases: getTodayPurchases(state.purchases, businessDate),
    todayTeaSoldKg: getTodayTeaSold(state.sales, businessDate),
    todayTeaPurchasedKg: getTodayTeaPurchased(state.purchases, businessDate),
    greenTeaStockKg: getTotalGreenTeaStock(state),
    blackTeaStockKg: getTotalBlackTeaStock(state),
    topSellingRegion: getTopSellingRegion(state.sales, state.locations, state.regions, todayRange(businessDate)),
    topSellingTea: getTopSellingTea(state.sales, todayRange(businessDate)),
    lowStockCount: getLowStockCount(state),
  }
}
