import { create } from 'zustand'
import type { BusinessData, Purchase, Sale } from '../domain/types'
import { createSeedData } from '../data/seed'
import { InMemoryBusinessRepository } from '../data/in-memory-business.repository'
import {
  createPurchase as createPurchaseTransaction,
  updatePurchase as updatePurchaseTransaction,
  voidPurchase as voidPurchaseTransaction,
} from '../services/purchases.service'
import type { CreatePurchaseInput, UpdatePurchaseInput } from '../services/purchases.service'
import {
  createSale as createSaleTransaction,
  updateSale as updateSaleTransaction,
  voidSale as voidSaleTransaction,
} from '../services/sales.service'
import type { CreateSaleInput, UpdateSaleInput } from '../services/sales.service'

export type BusinessActions = {
  createSale: (input: CreateSaleInput) => Sale
  updateSale: (saleId: string, changes: UpdateSaleInput) => Sale
  voidSale: (saleId: string, voidedByUserId?: string) => Sale
  createPurchase: (input: CreatePurchaseInput) => Purchase
  updatePurchase: (purchaseId: string, changes: UpdatePurchaseInput) => Purchase
  voidPurchase: (purchaseId: string, voidedByUserId?: string) => Purchase
}

export type BusinessStore = BusinessData & BusinessActions

const repository = new InMemoryBusinessRepository(createSeedData())

function getBusinessData(state: BusinessStore): BusinessData {
  return {
    regions: state.regions,
    locations: state.locations,
    suppliers: state.suppliers,
    users: state.users,
    sales: state.sales,
    purchases: state.purchases,
    payments: state.payments,
    inventoryMovements: state.inventoryMovements,
  }
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  ...repository.getSnapshot(),
  createSale: input => {
    const result = createSaleTransaction(getBusinessData(get()), input)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
  updateSale: (saleId, changes) => {
    const result = updateSaleTransaction(getBusinessData(get()), saleId, changes)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
  voidSale: (saleId, voidedByUserId) => {
    const result = voidSaleTransaction(getBusinessData(get()), saleId, voidedByUserId)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
  createPurchase: input => {
    const result = createPurchaseTransaction(getBusinessData(get()), input)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
  updatePurchase: (purchaseId, changes) => {
    const result = updatePurchaseTransaction(getBusinessData(get()), purchaseId, changes)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
  voidPurchase: (purchaseId, voidedByUserId) => {
    const result = voidPurchaseTransaction(getBusinessData(get()), purchaseId, voidedByUserId)
    repository.saveSnapshot(result.state)
    set(result.state)
    return result.entity
  },
}))

export function getBusinessSnapshot(): BusinessData {
  return getBusinessData(useBusinessStore.getState())
}
