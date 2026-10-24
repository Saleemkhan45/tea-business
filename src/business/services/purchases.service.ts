import { EntityNotFoundError, InsufficientStockError, InvalidQuantityError, InvalidTransactionError } from '../domain/errors'
import type {
  BusinessData,
  BusinessDate,
  BusinessOperationResult,
  InventoryMovement,
  OperationOptions,
  Purchase,
  PurchaseStatus,
  TeaType,
} from '../domain/types'
import { getCurrentStock } from './inventory.service'
import { getCurrentTimestamp, getPakistanBusinessDate, isValidBusinessDate } from '../utils/date'
import { roundCurrency, roundQuantity } from '../utils/formatters'

export type CreatePurchaseInput = {
  businessDate: BusinessDate
  sourceRegionId: string
  destinationLocationId: string
  supplierId: string
  teaType: TeaType
  quantityKg: number
  costPerKg: number
  taxAmount?: number
  discountAmount?: number
  shippingAmount?: number
  enteredByUserId: string
  status?: Exclude<PurchaseStatus, 'voided'>
  notes?: string
}

export type UpdatePurchaseInput = Partial<Omit<CreatePurchaseInput, 'status'>> & {
  status?: Exclude<PurchaseStatus, 'voided'>
}

const PURCHASE_STATUSES: readonly PurchaseStatus[] = ['pending', 'in_transit', 'completed', 'cancelled', 'voided']
const TEA_TYPES: readonly TeaType[] = ['green', 'black']

function createId(prefix: string, options: OperationOptions): string {
  return options.idFactory?.(prefix) ?? `${prefix}-${crypto.randomUUID()}`
}

export function calculatePurchaseTotal(
  quantityKg: number,
  costPerKg: number,
  taxAmount = 0,
  discountAmount = 0,
  shippingAmount = 0,
): number {
  const total = roundCurrency((quantityKg * costPerKg) + taxAmount + shippingAmount - discountAmount)
  if (total < 0) throw new InvalidTransactionError('Purchase discount cannot exceed subtotal, tax, and shipping.')
  return total
}

function getLocation(state: BusinessData, locationId: string) {
  const location = state.locations.find(item => item.id === locationId)
  if (!location) throw new EntityNotFoundError('Stock location', locationId)
  if (location.status !== 'active') throw new InvalidTransactionError(`Stock location '${location.name}' is inactive.`)
  return location
}

function validatePurchase(state: BusinessData, purchase: Purchase) {
  if (!isValidBusinessDate(purchase.businessDate)) throw new InvalidTransactionError('Purchase business date is invalid.')
  if (!TEA_TYPES.includes(purchase.teaType)) throw new InvalidTransactionError('Purchase tea type is invalid.')
  if (!Number.isFinite(purchase.quantityKg) || purchase.quantityKg <= 0) throw new InvalidQuantityError(purchase.quantityKg)
  if (!Number.isFinite(purchase.costPerKg) || purchase.costPerKg <= 0) throw new InvalidTransactionError('Cost per kilogram must be greater than zero.')
  if (![purchase.taxAmount, purchase.discountAmount, purchase.shippingAmount].every(value => Number.isFinite(value) && value >= 0)) {
    throw new InvalidTransactionError('Purchase adjustments must be zero or greater.')
  }
  if (!PURCHASE_STATUSES.includes(purchase.status) || purchase.status === 'voided') throw new InvalidTransactionError('Purchase status is invalid for this operation.')

  const sourceRegion = state.regions.find(region => region.id === purchase.sourceRegionId)
  if (!sourceRegion) throw new EntityNotFoundError('Source region', purchase.sourceRegionId)
  if (sourceRegion.status !== 'active') throw new InvalidTransactionError(`Source region '${sourceRegion.name}' is inactive.`)
  getLocation(state, purchase.destinationLocationId)
  const supplier = state.suppliers.find(item => item.id === purchase.supplierId)
  if (!supplier) throw new EntityNotFoundError('Supplier', purchase.supplierId)
  if (supplier.status !== 'active') throw new InvalidTransactionError(`Supplier '${supplier.name}' is inactive.`)
  if (!supplier.teaTypes.includes(purchase.teaType)) throw new InvalidTransactionError(`${supplier.name} does not supply the selected tea type.`)
  const operator = state.users.find(user => user.id === purchase.enteredByUserId)
  if (!operator) throw new EntityNotFoundError('Operator', purchase.enteredByUserId)
  if (operator.status !== 'active') throw new InvalidTransactionError(`Operator '${operator.name}' is inactive.`)
}

function assertStockCanBeRemoved(state: BusinessData, locationId: string, teaType: TeaType, quantityKg: number) {
  const location = getLocation(state, locationId)
  const availableKg = getCurrentStock(locationId, teaType, state.inventoryMovements)
  if (quantityKg > availableKg) throw new InsufficientStockError(availableKg, quantityKg, teaType, location.name)
}

function createMovement(
  purchase: Purchase,
  quantityDeltaKg: number,
  type: InventoryMovement['type'],
  reason: string,
  correlationId: string,
  options: OperationOptions,
): InventoryMovement {
  return {
    id: createId('movement', options),
    businessDate: type === 'purchase' && reason === 'Purchase received' ? purchase.businessDate : getPakistanBusinessDate(options.now),
    type,
    stockLocationId: purchase.destinationLocationId,
    teaType: purchase.teaType,
    quantityDeltaKg: roundQuantity(quantityDeltaKg),
    sourceType: 'purchase',
    sourceId: purchase.id,
    correlationId,
    createdByUserId: purchase.enteredByUserId,
    createdAt: getCurrentTimestamp(options.now),
    reason,
  }
}

export function createPurchase(
  state: BusinessData,
  input: CreatePurchaseInput,
  options: OperationOptions = {},
): BusinessOperationResult<Purchase> {
  const timestamp = getCurrentTimestamp(options.now)
  const purchaseId = createId('purchase', options)
  const quantityKg = roundQuantity(input.quantityKg)
  const costPerKg = roundCurrency(input.costPerKg)
  const taxAmount = roundCurrency(input.taxAmount ?? 0)
  const discountAmount = roundCurrency(input.discountAmount ?? 0)
  const shippingAmount = roundCurrency(input.shippingAmount ?? 0)
  const purchase: Purchase = {
    id: purchaseId,
    purchaseNumber: Math.max(0, ...state.purchases.map(item => item.purchaseNumber)) + 1,
    businessDate: input.businessDate,
    sourceRegionId: input.sourceRegionId,
    destinationLocationId: input.destinationLocationId,
    supplierId: input.supplierId,
    teaType: input.teaType,
    quantityKg,
    costPerKg,
    taxAmount,
    discountAmount,
    shippingAmount,
    totalCost: calculatePurchaseTotal(quantityKg, costPerKg, taxAmount, discountAmount, shippingAmount),
    status: input.status ?? 'completed',
    enteredByUserId: input.enteredByUserId,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  validatePurchase(state, purchase)

  const movements = purchase.status === 'completed'
    ? [createMovement(purchase, purchase.quantityKg, 'purchase', 'Purchase received', purchase.id, options)]
    : []
  return {
    entity: purchase,
    movements,
    state: {
      ...state,
      purchases: [purchase, ...state.purchases],
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}

export function updatePurchase(
  state: BusinessData,
  purchaseId: string,
  changes: UpdatePurchaseInput,
  options: OperationOptions = {},
): BusinessOperationResult<Purchase> {
  const original = state.purchases.find(purchase => purchase.id === purchaseId)
  if (!original) throw new EntityNotFoundError('Purchase', purchaseId)
  if (original.status === 'voided') throw new InvalidTransactionError('A voided purchase cannot be edited.')

  const quantityKg = roundQuantity(changes.quantityKg ?? original.quantityKg)
  const costPerKg = roundCurrency(changes.costPerKg ?? original.costPerKg)
  const taxAmount = roundCurrency(changes.taxAmount ?? original.taxAmount)
  const discountAmount = roundCurrency(changes.discountAmount ?? original.discountAmount)
  const shippingAmount = roundCurrency(changes.shippingAmount ?? original.shippingAmount)
  const updated: Purchase = {
    ...original,
    ...changes,
    quantityKg,
    costPerKg,
    taxAmount,
    discountAmount,
    shippingAmount,
    totalCost: calculatePurchaseTotal(quantityKg, costPerKg, taxAmount, discountAmount, shippingAmount),
    notes: changes.notes === undefined ? original.notes : changes.notes.trim() || undefined,
    updatedAt: getCurrentTimestamp(options.now),
  }
  validatePurchase(state, updated)

  const originalAffectsStock = original.status === 'completed'
  const updatedAffectsStock = updated.status === 'completed'
  const sameStockKey = original.destinationLocationId === updated.destinationLocationId && original.teaType === updated.teaType
  const correlationId = createId('purchase-update', options)
  const movements: InventoryMovement[] = []

  if (originalAffectsStock && updatedAffectsStock && sameStockKey) {
    const quantityDeltaKg = roundQuantity(updated.quantityKg - original.quantityKg)
    if (quantityDeltaKg < 0) assertStockCanBeRemoved(state, updated.destinationLocationId, updated.teaType, Math.abs(quantityDeltaKg))
    if (quantityDeltaKg !== 0) movements.push(createMovement(updated, quantityDeltaKg, 'adjustment', 'Purchase quantity updated', correlationId, options))
  } else {
    if (originalAffectsStock) assertStockCanBeRemoved(state, original.destinationLocationId, original.teaType, original.quantityKg)
    if (originalAffectsStock) {
      movements.push(createMovement(original, -original.quantityKg, 'reversal', 'Previous purchase inventory effect reversed', correlationId, options))
    }
    if (updatedAffectsStock) {
      movements.push(createMovement(updated, updated.quantityKg, 'purchase', 'Updated purchase inventory effect applied', correlationId, options))
    }
  }

  return {
    entity: updated,
    movements,
    state: {
      ...state,
      purchases: state.purchases.map(purchase => purchase.id === purchaseId ? updated : purchase),
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}

export function voidPurchase(
  state: BusinessData,
  purchaseId: string,
  voidedByUserId?: string,
  options: OperationOptions = {},
): BusinessOperationResult<Purchase> {
  const original = state.purchases.find(purchase => purchase.id === purchaseId)
  if (!original) throw new EntityNotFoundError('Purchase', purchaseId)
  if (original.status === 'voided') throw new InvalidTransactionError('Purchase is already voided.')
  const operatorId = voidedByUserId ?? original.enteredByUserId
  if (!state.users.some(user => user.id === operatorId)) throw new EntityNotFoundError('Operator', operatorId)
  if (original.status === 'completed') {
    assertStockCanBeRemoved(state, original.destinationLocationId, original.teaType, original.quantityKg)
  }

  const timestamp = getCurrentTimestamp(options.now)
  const voided: Purchase = {
    ...original,
    status: 'voided',
    updatedAt: timestamp,
    voidedAt: timestamp,
    voidedByUserId: operatorId,
  }
  const correlationId = createId('purchase-void', options)
  const movements = original.status === 'completed'
    ? [{ ...createMovement(original, -original.quantityKg, 'reversal', 'Purchase voided', correlationId, options), createdByUserId: operatorId }]
    : []

  return {
    entity: voided,
    movements,
    state: {
      ...state,
      purchases: state.purchases.map(purchase => purchase.id === purchaseId ? voided : purchase),
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}
