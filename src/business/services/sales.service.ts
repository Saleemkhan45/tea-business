import { EntityNotFoundError, InsufficientStockError, InvalidQuantityError, InvalidTransactionError } from '../domain/errors'
import type {
  BusinessData,
  BusinessDate,
  BusinessOperationResult,
  InventoryMovement,
  OperationOptions,
  Sale,
  SaleStatus,
  TeaType,
} from '../domain/types'
import { getCurrentStock } from './inventory.service'
import { getCurrentTimestamp, getPakistanBusinessDate, isValidBusinessDate } from '../utils/date'
import { roundCurrency, roundQuantity } from '../utils/formatters'

export type CreateSaleInput = {
  businessDate: BusinessDate
  customerName: string
  stockLocationId: string
  teaType: TeaType
  quantityKg: number
  unitPrice: number
  enteredByUserId: string
  status?: Exclude<SaleStatus, 'voided'>
  notes?: string
}

export type UpdateSaleInput = Partial<Omit<CreateSaleInput, 'status'>> & {
  status?: Exclude<SaleStatus, 'voided'>
}

const SALE_STATUSES: readonly SaleStatus[] = ['pending', 'completed', 'cancelled', 'voided']
const TEA_TYPES: readonly TeaType[] = ['green', 'black']

function createId(prefix: string, options: OperationOptions): string {
  return options.idFactory?.(prefix) ?? `${prefix}-${crypto.randomUUID()}`
}

function getLocation(state: BusinessData, locationId: string) {
  const location = state.locations.find(item => item.id === locationId)
  if (!location) throw new EntityNotFoundError('Stock location', locationId)
  if (location.status !== 'active') throw new InvalidTransactionError(`Stock location '${location.name}' is inactive.`)
  return location
}

function validateSale(state: BusinessData, sale: Omit<Sale, 'id' | 'reference' | 'createdAt' | 'updatedAt'>) {
  if (!isValidBusinessDate(sale.businessDate)) throw new InvalidTransactionError('Sale business date is invalid.')
  if (!sale.customerName.trim()) throw new InvalidTransactionError('Customer name is required.')
  if (!TEA_TYPES.includes(sale.teaType)) throw new InvalidTransactionError('Sale tea type is invalid.')
  if (!Number.isFinite(sale.quantityKg) || sale.quantityKg <= 0) throw new InvalidQuantityError(sale.quantityKg)
  if (!Number.isFinite(sale.unitPrice) || sale.unitPrice <= 0) throw new InvalidTransactionError('Unit price must be greater than zero.')
  if (!SALE_STATUSES.includes(sale.status) || sale.status === 'voided') throw new InvalidTransactionError('Sale status is invalid for this operation.')
  getLocation(state, sale.stockLocationId)
  const operator = state.users.find(user => user.id === sale.enteredByUserId)
  if (!operator) throw new EntityNotFoundError('Operator', sale.enteredByUserId)
  if (operator.status !== 'active') throw new InvalidTransactionError(`Operator '${operator.name}' is inactive.`)
}

function assertStockAvailable(state: BusinessData, locationId: string, teaType: TeaType, requestedKg: number) {
  const location = getLocation(state, locationId)
  const availableKg = getCurrentStock(locationId, teaType, state.inventoryMovements)
  if (requestedKg > availableKg) throw new InsufficientStockError(availableKg, requestedKg, teaType, location.name)
}

function createMovement(
  sale: Sale,
  quantityDeltaKg: number,
  type: InventoryMovement['type'],
  reason: string,
  correlationId: string,
  options: OperationOptions,
): InventoryMovement {
  const timestamp = getCurrentTimestamp(options.now)
  return {
    id: createId('movement', options),
    businessDate: type === 'sale' && reason === 'Sale completed' ? sale.businessDate : getPakistanBusinessDate(options.now),
    type,
    stockLocationId: sale.stockLocationId,
    teaType: sale.teaType,
    quantityDeltaKg: roundQuantity(quantityDeltaKg),
    sourceType: 'sale',
    sourceId: sale.id,
    correlationId,
    createdByUserId: sale.enteredByUserId,
    createdAt: timestamp,
    reason,
  }
}

export function createSale(
  state: BusinessData,
  input: CreateSaleInput,
  options: OperationOptions = {},
): BusinessOperationResult<Sale> {
  const status = input.status ?? 'completed'
  const timestamp = getCurrentTimestamp(options.now)
  const saleId = createId('sale', options)
  const quantityKg = roundQuantity(input.quantityKg)
  const unitPrice = roundCurrency(input.unitPrice)
  const sale: Sale = {
    id: saleId,
    reference: `SL-${saleId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`,
    businessDate: input.businessDate,
    customerName: input.customerName.trim(),
    stockLocationId: input.stockLocationId,
    teaType: input.teaType,
    quantityKg,
    unitPrice,
    totalAmount: roundCurrency(quantityKg * unitPrice),
    enteredByUserId: input.enteredByUserId,
    status,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  validateSale(state, sale)
  if (sale.status === 'completed') assertStockAvailable(state, sale.stockLocationId, sale.teaType, sale.quantityKg)

  const movements = sale.status === 'completed'
    ? [createMovement(sale, -sale.quantityKg, 'sale', 'Sale completed', sale.id, options)]
    : []
  return {
    entity: sale,
    movements,
    state: {
      ...state,
      sales: [sale, ...state.sales],
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}

export function updateSale(
  state: BusinessData,
  saleId: string,
  changes: UpdateSaleInput,
  options: OperationOptions = {},
): BusinessOperationResult<Sale> {
  const original = state.sales.find(sale => sale.id === saleId)
  if (!original) throw new EntityNotFoundError('Sale', saleId)
  if (original.status === 'voided') throw new InvalidTransactionError('A voided sale cannot be edited.')

  const quantityKg = roundQuantity(changes.quantityKg ?? original.quantityKg)
  const unitPrice = roundCurrency(changes.unitPrice ?? original.unitPrice)
  const updated: Sale = {
    ...original,
    ...changes,
    customerName: (changes.customerName ?? original.customerName).trim(),
    quantityKg,
    unitPrice,
    totalAmount: roundCurrency(quantityKg * unitPrice),
    notes: changes.notes === undefined ? original.notes : changes.notes.trim() || undefined,
    updatedAt: getCurrentTimestamp(options.now),
  }
  validateSale(state, updated)

  const originalAffectsStock = original.status === 'completed'
  const updatedAffectsStock = updated.status === 'completed'
  const sameStockKey = original.stockLocationId === updated.stockLocationId && original.teaType === updated.teaType
  const correlationId = createId('sale-update', options)
  const movements: InventoryMovement[] = []

  if (originalAffectsStock && updatedAffectsStock && sameStockKey) {
    const quantityDeltaKg = roundQuantity(original.quantityKg - updated.quantityKg)
    if (quantityDeltaKg < 0) assertStockAvailable(state, updated.stockLocationId, updated.teaType, Math.abs(quantityDeltaKg))
    if (quantityDeltaKg !== 0) movements.push(createMovement(updated, quantityDeltaKg, 'adjustment', 'Sale quantity updated', correlationId, options))
  } else {
    if (updatedAffectsStock) assertStockAvailable(state, updated.stockLocationId, updated.teaType, updated.quantityKg)
    if (originalAffectsStock) {
      movements.push(createMovement(original, original.quantityKg, 'reversal', 'Previous sale inventory effect reversed', correlationId, options))
    }
    if (updatedAffectsStock) {
      movements.push(createMovement(updated, -updated.quantityKg, 'sale', 'Updated sale inventory effect applied', correlationId, options))
    }
  }

  return {
    entity: updated,
    movements,
    state: {
      ...state,
      sales: state.sales.map(sale => sale.id === saleId ? updated : sale),
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}

export function voidSale(
  state: BusinessData,
  saleId: string,
  voidedByUserId?: string,
  options: OperationOptions = {},
): BusinessOperationResult<Sale> {
  const original = state.sales.find(sale => sale.id === saleId)
  if (!original) throw new EntityNotFoundError('Sale', saleId)
  if (original.status === 'voided') throw new InvalidTransactionError('Sale is already voided.')
  const operatorId = voidedByUserId ?? original.enteredByUserId
  if (!state.users.some(user => user.id === operatorId)) throw new EntityNotFoundError('Operator', operatorId)

  const timestamp = getCurrentTimestamp(options.now)
  const voided: Sale = {
    ...original,
    status: 'voided',
    updatedAt: timestamp,
    voidedAt: timestamp,
    voidedByUserId: operatorId,
  }
  const correlationId = createId('sale-void', options)
  const movements = original.status === 'completed'
    ? [{ ...createMovement(original, original.quantityKg, 'reversal', 'Sale voided', correlationId, options), createdByUserId: operatorId }]
    : []

  return {
    entity: voided,
    movements,
    state: {
      ...state,
      sales: state.sales.map(sale => sale.id === saleId ? voided : sale),
      inventoryMovements: [...state.inventoryMovements, ...movements],
    },
  }
}
