import type { BusinessData, InventoryMovement, Operator, Region, StockLocation, Supplier, TeaType } from '../domain/types'
import { createPurchase } from '../services/purchases.service'
import { createSale } from '../services/sales.service'
import { getPakistanBusinessDate, shiftBusinessDate, startOfDay } from '../utils/date'

const REGION_IDS = {
  swat: 'region-swat',
  peshawar: 'region-peshawar',
  mansehra: 'region-mansehra',
  islamabad: 'region-islamabad',
  lahore: 'region-lahore',
} as const

const LOCATION_IDS = {
  swat: 'location-swat-main',
  peshawar: 'location-peshawar-main',
  mansehra: 'location-mansehra-main',
  islamabad: 'location-islamabad-main',
  lahore: 'location-lahore-main',
} as const

const USER_IDS = {
  admin: 'user-saleem-khan',
  operator: 'user-operations',
} as const

function createSeedIdFactory() {
  const counters = new Map<string, number>()
  return (prefix: string) => {
    const next = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, next)
    return `${prefix}-seed-${String(next).padStart(3, '0')}`
  }
}

function createOpeningMovement(
  locationId: string,
  teaType: TeaType,
  quantityKg: number,
  businessDate: string,
  createdAt: string,
): InventoryMovement {
  const id = `opening-${locationId}-${teaType}`
  return {
    id,
    businessDate,
    type: 'opening_balance',
    stockLocationId: locationId,
    teaType,
    quantityDeltaKg: quantityKg,
    sourceType: 'opening_balance',
    sourceId: id,
    correlationId: id,
    createdByUserId: USER_IDS.admin,
    createdAt,
    reason: 'Opening inventory balance',
  }
}

export function createSeedData(referenceDate = getPakistanBusinessDate()): BusinessData {
  const timestamp = startOfDay(referenceDate).toISOString()
  const openingDate = shiftBusinessDate(referenceDate, -30)
  const previousDate = shiftBusinessDate(referenceDate, -1)
  const regions: Region[] = [
    { id: REGION_IDS.swat, code: 'SWAT', name: 'Swat', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: REGION_IDS.peshawar, code: 'PEW', name: 'Peshawar', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: REGION_IDS.mansehra, code: 'MNS', name: 'Mansehra', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: REGION_IDS.islamabad, code: 'ISB', name: 'Islamabad', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: REGION_IDS.lahore, code: 'LHE', name: 'Lahore', status: 'active', createdAt: timestamp, updatedAt: timestamp },
  ]
  const locations: StockLocation[] = [
    { id: LOCATION_IDS.swat, regionId: REGION_IDS.swat, code: 'SWAT-WH', name: 'Swat Warehouse', status: 'active', lowStockThresholdKg: 50, capacityKg: 1000, createdAt: timestamp, updatedAt: timestamp },
    { id: LOCATION_IDS.peshawar, regionId: REGION_IDS.peshawar, code: 'PEW-WH', name: 'Peshawar Warehouse', status: 'active', lowStockThresholdKg: 60, capacityKg: 1400, createdAt: timestamp, updatedAt: timestamp },
    { id: LOCATION_IDS.mansehra, regionId: REGION_IDS.mansehra, code: 'MNS-WH', name: 'Mansehra Warehouse', status: 'active', lowStockThresholdKg: 40, capacityKg: 800, createdAt: timestamp, updatedAt: timestamp },
    { id: LOCATION_IDS.islamabad, regionId: REGION_IDS.islamabad, code: 'ISB-WH', name: 'Islamabad Warehouse', status: 'active', lowStockThresholdKg: 70, capacityKg: 1600, createdAt: timestamp, updatedAt: timestamp },
    { id: LOCATION_IDS.lahore, regionId: REGION_IDS.lahore, code: 'LHE-WH', name: 'Lahore Warehouse', status: 'active', lowStockThresholdKg: 60, capacityKg: 1400, createdAt: timestamp, updatedAt: timestamp },
  ]
  const users: Operator[] = [
    { id: USER_IDS.admin, name: 'Saleem Khan', role: 'Administrator', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: USER_IDS.operator, name: 'Operations Staff', role: 'Operator', status: 'active', createdAt: timestamp, updatedAt: timestamp },
  ]
  const suppliers: Supplier[] = [
    { id: 'supplier-mountain-leaf', sourceRegionId: REGION_IDS.swat, name: 'Mountain Leaf Co.', contactPerson: 'Naveed Ahmad', teaTypes: ['green', 'black'], status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 'supplier-frontier-tea', sourceRegionId: REGION_IDS.peshawar, name: 'Frontier Tea Estate', contactPerson: 'Usman Tariq', teaTypes: ['green', 'black'], status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 'supplier-mansehra-organics', sourceRegionId: REGION_IDS.mansehra, name: 'Mansehra Organics', contactPerson: 'Aiman Raza', teaTypes: ['green', 'black'], status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 'supplier-lahore-traders', sourceRegionId: REGION_IDS.lahore, name: 'Lahore Tea Traders', contactPerson: 'Hassan Ali', teaTypes: ['green', 'black'], status: 'active', createdAt: timestamp, updatedAt: timestamp },
  ]

  const openingBalances: Array<[string, TeaType, number]> = [
    [LOCATION_IDS.swat, 'green', 70], [LOCATION_IDS.swat, 'black', 120],
    [LOCATION_IDS.peshawar, 'green', 200], [LOCATION_IDS.peshawar, 'black', 150],
    [LOCATION_IDS.mansehra, 'green', 80], [LOCATION_IDS.mansehra, 'black', 90],
    [LOCATION_IDS.islamabad, 'green', 160], [LOCATION_IDS.islamabad, 'black', 130],
    [LOCATION_IDS.lahore, 'green', 140], [LOCATION_IDS.lahore, 'black', 110],
  ]
  const openingMovements = openingBalances.map(([locationId, teaType, quantityKg]) =>
    createOpeningMovement(locationId, teaType, quantityKg, openingDate, timestamp))

  let state: BusinessData = {
    regions,
    locations,
    suppliers,
    users,
    sales: [],
    purchases: [],
    payments: [],
    inventoryMovements: openingMovements,
  }
  const operationOptions = { now: startOfDay(referenceDate), idFactory: createSeedIdFactory() }

  state = createPurchase(state, {
    businessDate: referenceDate,
    sourceRegionId: REGION_IDS.swat,
    destinationLocationId: LOCATION_IDS.swat,
    supplierId: 'supplier-mountain-leaf',
    teaType: 'green',
    quantityKg: 50,
    costPerKg: 800,
    enteredByUserId: USER_IDS.admin,
    status: 'completed',
    notes: 'Fresh green tea received into Swat warehouse.',
  }, operationOptions).state
  state = createPurchase(state, {
    businessDate: previousDate,
    sourceRegionId: REGION_IDS.mansehra,
    destinationLocationId: LOCATION_IDS.islamabad,
    supplierId: 'supplier-mansehra-organics',
    teaType: 'black',
    quantityKg: 40,
    costPerKg: 720,
    shippingAmount: 2500,
    enteredByUserId: USER_IDS.operator,
    status: 'completed',
  }, operationOptions).state
  state = createPurchase(state, {
    businessDate: referenceDate,
    sourceRegionId: REGION_IDS.peshawar,
    destinationLocationId: LOCATION_IDS.lahore,
    supplierId: 'supplier-frontier-tea',
    teaType: 'green',
    quantityKg: 60,
    costPerKg: 780,
    enteredByUserId: USER_IDS.operator,
    status: 'completed',
  }, operationOptions).state
  state = createPurchase(state, {
    businessDate: referenceDate,
    sourceRegionId: REGION_IDS.swat,
    destinationLocationId: LOCATION_IDS.peshawar,
    supplierId: 'supplier-mountain-leaf',
    teaType: 'black',
    quantityKg: 75,
    costPerKg: 760,
    enteredByUserId: USER_IDS.operator,
    status: 'in_transit',
  }, operationOptions).state

  state = createSale(state, {
    businessDate: referenceDate,
    customerName: 'Swat Tea House',
    stockLocationId: LOCATION_IDS.swat,
    teaType: 'green',
    quantityKg: 20,
    unitPrice: 1000,
    enteredByUserId: USER_IDS.admin,
  }, operationOptions).state
  state = createSale(state, {
    businessDate: referenceDate,
    customerName: 'Khyber Market',
    stockLocationId: LOCATION_IDS.peshawar,
    teaType: 'black',
    quantityKg: 30,
    unitPrice: 1100,
    enteredByUserId: USER_IDS.operator,
  }, operationOptions).state
  state = createSale(state, {
    businessDate: referenceDate,
    customerName: 'Capital Caterers',
    stockLocationId: LOCATION_IDS.islamabad,
    teaType: 'black',
    quantityKg: 25,
    unitPrice: 1150,
    enteredByUserId: USER_IDS.admin,
  }, operationOptions).state
  state = createSale(state, {
    businessDate: referenceDate,
    customerName: 'Lahore Tea House',
    stockLocationId: LOCATION_IDS.lahore,
    teaType: 'green',
    quantityKg: 35,
    unitPrice: 1050,
    enteredByUserId: USER_IDS.operator,
  }, operationOptions).state
  state = createSale(state, {
    businessDate: referenceDate,
    customerName: 'Mansehra Retail',
    stockLocationId: LOCATION_IDS.mansehra,
    teaType: 'green',
    quantityKg: 10,
    unitPrice: 980,
    enteredByUserId: USER_IDS.operator,
    status: 'pending',
  }, operationOptions).state

  return state
}

export const seedIds = {
  business: 'business-tea-wholesale',
  regions: REGION_IDS,
  locations: LOCATION_IDS,
  users: USER_IDS,
} as const
