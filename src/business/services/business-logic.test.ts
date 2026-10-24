import { describe, expect, it } from 'vitest'
import { InsufficientStockError } from '../domain/errors'
import type { BusinessData, InventoryMovement, OperationOptions, TeaType } from '../domain/types'
import { createSeedData, seedIds } from '../data/seed'
import { getBusinessSnapshot, useBusinessStore } from '../store/business.store'
import { getDashboardAnalytics } from './analytics.service'
import { getCurrentStock } from './inventory.service'
import { createPurchase, updatePurchase, voidPurchase } from './purchases.service'
import { createSale, updateSale, voidSale } from './sales.service'
import { startOfDay } from '../utils/date'

const TEST_DATE = '2026-09-30'
const USER_ID = 'user-test'
const SWAT_REGION_ID = 'region-swat'
const PESHAWAR_REGION_ID = 'region-peshawar'
const SWAT_LOCATION_ID = 'location-swat'
const PESHAWAR_LOCATION_ID = 'location-peshawar'
const SUPPLIER_ID = 'supplier-test'

type FixtureStock = {
  swatGreen?: number
  swatBlack?: number
  peshawarGreen?: number
  peshawarBlack?: number
}

function openingMovement(locationId: string, teaType: TeaType, quantityKg: number): InventoryMovement {
  const id = `opening-${locationId}-${teaType}`
  return {
    id,
    businessDate: TEST_DATE,
    type: 'opening_balance',
    stockLocationId: locationId,
    teaType,
    quantityDeltaKg: quantityKg,
    sourceType: 'opening_balance',
    sourceId: id,
    correlationId: id,
    createdByUserId: USER_ID,
    createdAt: startOfDay(TEST_DATE).toISOString(),
  }
}

function createTestState(stock: FixtureStock = {}): BusinessData {
  const timestamp = startOfDay(TEST_DATE).toISOString()
  const quantities: Array<[string, TeaType, number]> = [
    [SWAT_LOCATION_ID, 'green', stock.swatGreen ?? 100],
    [SWAT_LOCATION_ID, 'black', stock.swatBlack ?? 0],
    [PESHAWAR_LOCATION_ID, 'green', stock.peshawarGreen ?? 0],
    [PESHAWAR_LOCATION_ID, 'black', stock.peshawarBlack ?? 0],
  ]
  return {
    regions: [
      { id: SWAT_REGION_ID, code: 'SWAT', name: 'Swat', status: 'active', createdAt: timestamp, updatedAt: timestamp },
      { id: PESHAWAR_REGION_ID, code: 'PEW', name: 'Peshawar', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    ],
    locations: [
      { id: SWAT_LOCATION_ID, regionId: SWAT_REGION_ID, code: 'SWAT-WH', name: 'Swat', status: 'active', lowStockThresholdKg: 20, createdAt: timestamp, updatedAt: timestamp },
      { id: PESHAWAR_LOCATION_ID, regionId: PESHAWAR_REGION_ID, code: 'PEW-WH', name: 'Peshawar', status: 'active', lowStockThresholdKg: 20, createdAt: timestamp, updatedAt: timestamp },
    ],
    suppliers: [{ id: SUPPLIER_ID, sourceRegionId: SWAT_REGION_ID, name: 'Test Supplier', contactPerson: 'Test Contact', teaTypes: ['green', 'black'], status: 'active', createdAt: timestamp, updatedAt: timestamp }],
    users: [{ id: USER_ID, name: 'Test Operator', role: 'Operator', status: 'active', createdAt: timestamp, updatedAt: timestamp }],
    sales: [],
    purchases: [],
    payments: [],
    inventoryMovements: quantities.filter(([, , quantityKg]) => quantityKg !== 0).map(([locationId, teaType, quantityKg]) => openingMovement(locationId, teaType, quantityKg)),
  }
}

function operationOptions(): OperationOptions {
  let sequence = 0
  return {
    now: startOfDay(TEST_DATE),
    idFactory: prefix => `${prefix}-test-${++sequence}`,
  }
}

function saleInput(quantityKg: number, stockLocationId = SWAT_LOCATION_ID, teaType: TeaType = 'green') {
  return {
    businessDate: TEST_DATE,
    customerName: 'Test Customer',
    stockLocationId,
    teaType,
    quantityKg,
    unitPrice: 1000,
    enteredByUserId: USER_ID,
  } as const
}

function purchaseInput(quantityKg: number, destinationLocationId = SWAT_LOCATION_ID, teaType: TeaType = 'green') {
  return {
    businessDate: TEST_DATE,
    sourceRegionId: SWAT_REGION_ID,
    destinationLocationId,
    supplierId: SUPPLIER_ID,
    teaType,
    quantityKg,
    costPerKg: 800,
    enteredByUserId: USER_ID,
    status: 'completed',
  } as const
}

describe('sales inventory transactions', () => {
  it('deducts a completed sale from current stock', () => {
    const result = createSale(createTestState(), saleInput(20), operationOptions())
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(80)
    expect(result.state.sales).toHaveLength(1)
    expect(result.movements).toHaveLength(1)
    expect(result.movements[0]?.quantityDeltaKg).toBe(-20)
  })

  it('rejects an oversell without changing the original state', () => {
    const state = createTestState({ swatGreen: 10 })
    expect(() => createSale(state, saleInput(20), operationOptions())).toThrow(InsufficientStockError)
    expect(state.sales).toHaveLength(0)
    expect(state.inventoryMovements).toHaveLength(1)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', state.inventoryMovements)).toBe(10)
  })

  it('applies only the additional quantity when a sale changes from 20 kg to 30 kg', () => {
    const options = operationOptions()
    const created = createSale(createTestState(), saleInput(20), options)
    const updated = updateSale(created.state, created.entity.id, { quantityKg: 30 }, options)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(70)
    expect(updated.movements).toHaveLength(1)
    expect(updated.movements[0]?.quantityDeltaKg).toBe(-10)
  })

  it('returns the difference when a sale changes from 20 kg to 15 kg', () => {
    const options = operationOptions()
    const created = createSale(createTestState(), saleInput(20), options)
    const updated = updateSale(created.state, created.entity.id, { quantityKg: 15 }, options)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(85)
    expect(updated.movements[0]?.quantityDeltaKg).toBe(5)
  })

  it('restores inventory and preserves a voided sale', () => {
    const options = operationOptions()
    const created = createSale(createTestState(), saleInput(20), options)
    const voided = voidSale(created.state, created.entity.id, USER_ID, options)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', voided.state.inventoryMovements)).toBe(100)
    expect(voided.entity.status).toBe('voided')
    expect(voided.state.sales).toHaveLength(1)
    expect(voided.movements[0]?.quantityDeltaKg).toBe(20)
  })

  it('reverses the old location before applying a changed sale location', () => {
    const options = operationOptions()
    const created = createSale(
      createTestState({ swatGreen: 100, peshawarGreen: 100 }),
      saleInput(20),
      options,
    )
    const updated = updateSale(created.state, created.entity.id, { stockLocationId: PESHAWAR_LOCATION_ID }, options)

    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(100)
    expect(getCurrentStock(PESHAWAR_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(80)
    expect(updated.movements.map(movement => movement.quantityDeltaKg)).toEqual([20, -20])
  })

  it('reverses the old tea type before applying a changed sale tea type', () => {
    const options = operationOptions()
    const created = createSale(
      createTestState({ swatGreen: 100, swatBlack: 100 }),
      saleInput(20),
      options,
    )
    const updated = updateSale(created.state, created.entity.id, { teaType: 'black' }, options)

    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(100)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'black', updated.state.inventoryMovements)).toBe(80)
    expect(updated.movements.map(movement => movement.quantityDeltaKg)).toEqual([20, -20])
  })
})

describe('purchase inventory transactions', () => {
  it('adds a completed purchase to current stock', () => {
    const result = createPurchase(createTestState({ swatGreen: 80 }), purchaseInput(50), operationOptions())
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(130)
    expect(result.entity.totalCost).toBe(40000)
    expect(result.movements[0]?.quantityDeltaKg).toBe(50)
  })

  it('adds only 20 kg when a purchase changes from 50 kg to 70 kg', () => {
    const options = operationOptions()
    const created = createPurchase(createTestState({ swatGreen: 80 }), purchaseInput(50), options)
    const updated = updatePurchase(created.state, created.entity.id, { quantityKg: 70 }, options)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(150)
    expect(updated.movements[0]?.quantityDeltaKg).toBe(20)
  })

  it('removes only 20 kg when a purchase changes from 50 kg to 30 kg', () => {
    const options = operationOptions()
    const created = createPurchase(createTestState({ swatGreen: 80 }), purchaseInput(50), options)
    const updated = updatePurchase(created.state, created.entity.id, { quantityKg: 30 }, options)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(110)
    expect(updated.movements[0]?.quantityDeltaKg).toBe(-20)
  })

  it('keeps purchase source region separate from stock destination', () => {
    const result = createPurchase(
      createTestState({ swatGreen: 100, peshawarGreen: 10 }),
      purchaseInput(50, PESHAWAR_LOCATION_ID),
      operationOptions(),
    )

    expect(result.entity.sourceRegionId).toBe(SWAT_REGION_ID)
    expect(result.entity.destinationLocationId).toBe(PESHAWAR_LOCATION_ID)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(100)
    expect(getCurrentStock(PESHAWAR_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(60)
  })

  it('reverses a completed purchase when it is voided', () => {
    const options = operationOptions()
    const created = createPurchase(createTestState({ swatGreen: 80 }), purchaseInput(50), options)
    const voided = voidPurchase(created.state, created.entity.id, USER_ID, options)

    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', voided.state.inventoryMovements)).toBe(80)
    expect(voided.entity.status).toBe('voided')
    expect(voided.state.purchases).toHaveLength(1)
    expect(voided.movements[0]?.quantityDeltaKg).toBe(-50)
  })

  it('reverses the old destination before applying a changed purchase destination', () => {
    const options = operationOptions()
    const created = createPurchase(createTestState(), purchaseInput(50), options)
    const updated = updatePurchase(
      created.state,
      created.entity.id,
      { destinationLocationId: PESHAWAR_LOCATION_ID },
      options,
    )

    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(100)
    expect(getCurrentStock(PESHAWAR_LOCATION_ID, 'green', updated.state.inventoryMovements)).toBe(50)
    expect(updated.movements.map(movement => movement.quantityDeltaKg)).toEqual([-50, 50])
  })
})

describe('inventory isolation and analytics', () => {
  it('keeps Swat and Peshawar inventory independent', () => {
    const state = createTestState({ swatGreen: 100, peshawarGreen: 200 })
    const result = createSale(state, saleInput(20, SWAT_LOCATION_ID), operationOptions())
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(80)
    expect(getCurrentStock(PESHAWAR_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(200)
  })

  it('keeps Green Tea and Black Tea inventory independent', () => {
    const state = createTestState({ swatGreen: 100, swatBlack: 100 })
    const result = createSale(state, saleInput(20, SWAT_LOCATION_ID, 'green'), operationOptions())
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', result.state.inventoryMovements)).toBe(80)
    expect(getCurrentStock(SWAT_LOCATION_ID, 'black', result.state.inventoryMovements)).toBe(100)
  })

  it('derives dashboard totals from completed source transactions', () => {
    const options = operationOptions()
    let state = createTestState({ swatGreen: 100, swatBlack: 40 })
    state = createPurchase(state, purchaseInput(50), options).state
    state = createSale(state, saleInput(20), options).state
    state = createSale(state, { ...saleInput(10), status: 'pending' }, options).state
    const dashboard = getDashboardAnalytics(state, TEST_DATE)

    expect(dashboard.todaySales).toBe(20000)
    expect(dashboard.todayPurchases).toBe(40000)
    expect(dashboard.todayTeaSoldKg).toBe(20)
    expect(dashboard.todayTeaPurchasedKg).toBe(50)
    expect(dashboard.greenTeaStockKg).toBe(130)
    expect(dashboard.blackTeaStockKg).toBe(40)
    expect(dashboard.topSellingRegion?.regionId).toBe(SWAT_REGION_ID)
    expect(dashboard.topSellingTea?.teaType).toBe('green')
  })

  it('reconciles the complete manual sale, purchase, sale, and void scenario', () => {
    const options = operationOptions()
    let state = createTestState({ swatGreen: 100 })
    const firstSale = createSale(state, saleInput(20), options)
    state = firstSale.state
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', state.inventoryMovements)).toBe(80)

    state = createPurchase(state, purchaseInput(50), options).state
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', state.inventoryMovements)).toBe(130)

    const secondSale = createSale(state, saleInput(30), options)
    state = secondSale.state
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', state.inventoryMovements)).toBe(100)

    state = voidSale(state, secondSale.entity.id, USER_ID, options).state
    expect(getCurrentStock(SWAT_LOCATION_ID, 'green', state.inventoryMovements)).toBe(130)
  })

  it('produces mathematically reconciled seed inventory', () => {
    const seed = createSeedData(TEST_DATE)
    expect(getCurrentStock(seedIds.locations.swat, 'green', seed.inventoryMovements)).toBe(100)
    expect(getDashboardAnalytics(seed, TEST_DATE)).toMatchObject({
      todaySales: 118500,
      todayPurchases: 86800,
      todayTeaSoldKg: 110,
      todayTeaPurchasedKg: 110,
    })
    expect(seed.locations.every(location =>
      (['green', 'black'] as const).every(teaType =>
        getCurrentStock(location.id, teaType, seed.inventoryMovements) >= 0))).toBe(true)
  })

  it('leaves the Zustand snapshot unchanged when an action fails validation', () => {
    const before = structuredClone(getBusinessSnapshot())
    const attempt = () => useBusinessStore.getState().createSale({
      businessDate: TEST_DATE,
      customerName: 'Impossible Order',
      stockLocationId: seedIds.locations.swat,
      teaType: 'green',
      quantityKg: 1_000_000,
      unitPrice: 1000,
      enteredByUserId: seedIds.users.admin,
    })

    expect(attempt).toThrow(InsufficientStockError)
    expect(getBusinessSnapshot()).toEqual(before)
  })
})
