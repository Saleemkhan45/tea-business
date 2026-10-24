import type { BusinessData, BusinessDate, DateRange } from '../domain/types'
import {
  getDashboardAnalytics,
  getPurchasesByRegion,
  getPurchasesByTeaType,
  getSalesByRegion,
  getSalesByTeaType,
  getTopSellingRegion,
  getTopSellingTea,
} from '../services/analytics.service'

export const selectDashboardAnalytics = (state: BusinessData, businessDate?: BusinessDate) =>
  getDashboardAnalytics(state, businessDate)

export const selectSalesByRegion = (state: BusinessData, dateRange?: DateRange) =>
  getSalesByRegion(state.sales, state.locations, state.regions, dateRange)

export const selectPurchasesBySourceRegion = (state: BusinessData, dateRange?: DateRange) =>
  getPurchasesByRegion(state.purchases, state.locations, state.regions, 'source', dateRange)

export const selectPurchasesByDestinationRegion = (state: BusinessData, dateRange?: DateRange) =>
  getPurchasesByRegion(state.purchases, state.locations, state.regions, 'destination', dateRange)

export const selectSalesByTeaType = (state: BusinessData, dateRange?: DateRange) =>
  getSalesByTeaType(state.sales, dateRange)

export const selectPurchasesByTeaType = (state: BusinessData, dateRange?: DateRange) =>
  getPurchasesByTeaType(state.purchases, dateRange)

export const selectTopSellingRegion = (state: BusinessData, dateRange?: DateRange) =>
  getTopSellingRegion(state.sales, state.locations, state.regions, dateRange)

export const selectTopSellingTea = (state: BusinessData, dateRange?: DateRange) =>
  getTopSellingTea(state.sales, dateRange)
