import type { EntityId, TeaType } from './types'

export type DomainErrorCode =
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_QUANTITY'
  | 'ENTITY_NOT_FOUND'
  | 'INVALID_TRANSACTION'

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InvalidQuantityError extends DomainError {
  readonly quantity: number

  constructor(quantity: number, label = 'Quantity') {
    super('INVALID_QUANTITY', `${label} must be greater than zero.`)
    this.name = 'InvalidQuantityError'
    this.quantity = quantity
  }
}

export class EntityNotFoundError extends DomainError {
  readonly entityType: string
  readonly entityId: EntityId

  constructor(entityType: string, entityId: EntityId) {
    super('ENTITY_NOT_FOUND', `${entityType} '${entityId}' was not found.`)
    this.name = 'EntityNotFoundError'
    this.entityType = entityType
    this.entityId = entityId
  }
}

export class InvalidTransactionError extends DomainError {
  constructor(message: string) {
    super('INVALID_TRANSACTION', message)
    this.name = 'InvalidTransactionError'
  }
}

export class InsufficientStockError extends DomainError {
  readonly availableKg: number
  readonly requestedKg: number
  readonly teaType: TeaType
  readonly locationName: string

  constructor(availableKg: number, requestedKg: number, teaType: TeaType, locationName: string) {
    const teaLabel = teaType === 'green' ? 'Green Tea' : 'Black Tea'
    const availableLabel = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(availableKg)
    super('INSUFFICIENT_STOCK', `Insufficient stock. Only ${availableLabel} kg of ${teaLabel} is available at ${locationName}.`)
    this.name = 'InsufficientStockError'
    this.availableKg = availableKg
    this.requestedKg = requestedKg
    this.teaType = teaType
    this.locationName = locationName
  }
}
