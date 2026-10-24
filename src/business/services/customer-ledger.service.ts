import { EntityNotFoundError, InvalidQuantityError, InvalidTransactionError } from '../domain/errors'
import { PAYMENT_METHODS } from '../domain/types'
import type {
  BusinessDate,
  EntityId,
  IsoTimestamp,
  OperationOptions,
  PaymentMethod,
  TeaType,
} from '../domain/types'
import type {
  CreateAdjustmentRequest,
  CreateCustomerPaymentRequest,
  CreateCustomerPurchaseRequest,
  CreateOpeningBalanceRequest,
} from '../domain/customer-ledger.contracts'
import type {
  Customer,
  CustomerAdjustmentTransaction,
  CustomerLedgerData,
  CustomerLedgerTransaction,
  CustomerOpeningBalanceTransaction,
  CustomerPaymentTransaction,
  CustomerPurchaseTransaction,
} from '../domain/customer-ledger.types'
import {
  calculateCustomerPurchaseAmountPkr,
  compareCustomerLedgerTransactions,
  hasSupportedQuantityPrecision,
} from '../domain/customer-ledger.types'
import { getCurrentTimestamp, isValidBusinessDate } from '../utils/date'

export type CustomerLedgerOperationResult<TTransaction extends CustomerLedgerTransaction> = {
  state: CustomerLedgerData
  transaction: TTransaction
}

export type CreateCustomerLedgerPurchaseInput = CreateCustomerPurchaseRequest & {
  createdBy: EntityId
}

export type CreateCustomerLedgerPaymentInput = CreateCustomerPaymentRequest & {
  createdBy: EntityId
}

export type CreateCustomerLedgerOpeningBalanceInput = CreateOpeningBalanceRequest & {
  createdBy: EntityId
}

export type CreateCustomerLedgerAdjustmentInput = CreateAdjustmentRequest & {
  createdBy: EntityId
}

export type VoidCustomerLedgerTransactionInput = {
  transactionId: EntityId
  voidedBy: EntityId
  voidReason: string
}

type CustomerLedgerInputBase = {
  customerId: EntityId
  businessDate: BusinessDate
  createdBy: EntityId
  notes?: string | null
}

type CustomerLedgerTransactionBaseFields = {
  id: EntityId
  businessId: EntityId
  customerId: EntityId
  businessDate: BusinessDate
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  createdBy: EntityId
  status: 'active'
  notes: string | null
}

const TEA_TYPES: readonly TeaType[] = ['green', 'black']

function createId(prefix: string, options: OperationOptions): EntityId {
  return options.idFactory?.(prefix) ?? `${prefix}-${crypto.randomUUID()}`
}

function normalizeNotes(notes?: string | null): string | null {
  const normalized = notes?.trim()
  return normalized ? normalized : null
}

function assertRequiredId(value: EntityId, label: string) {
  if (!value.trim()) throw new InvalidTransactionError(`${label} is required.`)
}

function assertValidBusinessDate(businessDate: BusinessDate, label: string) {
  if (!isValidBusinessDate(businessDate)) throw new InvalidTransactionError(`${label} business date is invalid.`)
}

function assertSafeIntegerPkr(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new InvalidTransactionError(`${label} must be an integer PKR amount.`)
}

function assertPositivePkr(value: number, label: string) {
  assertSafeIntegerPkr(value, label)
  if (value <= 0) throw new InvalidTransactionError(`${label} must be greater than zero.`)
}

function assertNonNegativePkr(value: number, label: string) {
  assertSafeIntegerPkr(value, label)
  if (value < 0) throw new InvalidTransactionError(`${label} must be zero or greater.`)
}

function assertNonZeroPkr(value: number, label: string) {
  assertSafeIntegerPkr(value, label)
  if (value === 0) throw new InvalidTransactionError(`${label} must not be zero.`)
}

function assertTeaType(teaType: TeaType) {
  if (!TEA_TYPES.includes(teaType)) throw new InvalidTransactionError('Customer purchase tea type is invalid.')
}

function assertPaymentMethod(paymentMethod: PaymentMethod) {
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new InvalidTransactionError('Customer payment method is invalid.')
}

function getActiveCustomer(state: CustomerLedgerData, customerId: EntityId): Customer {
  const customer = state.customers.find(item => item.id === customerId)
  if (!customer) throw new EntityNotFoundError('Customer', customerId)
  if (!customer.isActive) throw new InvalidTransactionError(`Customer '${customer.name}' is inactive.`)
  return customer
}

function createBaseFields(
  state: CustomerLedgerData,
  input: CustomerLedgerInputBase,
  prefix: string,
  options: OperationOptions,
): CustomerLedgerTransactionBaseFields {
  const customer = getActiveCustomer(state, input.customerId)
  assertValidBusinessDate(input.businessDate, 'Customer ledger')
  assertRequiredId(input.createdBy, 'Creator')

  const timestamp = getCurrentTimestamp(options.now)
  return {
    id: createId(prefix, options),
    businessId: customer.businessId,
    customerId: customer.id,
    businessDate: input.businessDate,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.createdBy,
    status: 'active',
    notes: normalizeNotes(input.notes),
  }
}

function appendTransaction<TTransaction extends CustomerLedgerTransaction>(
  state: CustomerLedgerData,
  transaction: TTransaction,
): CustomerLedgerOperationResult<TTransaction> {
  return {
    transaction,
    state: {
      ...state,
      customers: [...state.customers],
      transactions: [transaction, ...state.transactions],
    },
  }
}

function assertPurchaseQuantity(quantityKg: number) {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) throw new InvalidQuantityError(quantityKg)
  if (!hasSupportedQuantityPrecision(quantityKg)) {
    throw new InvalidTransactionError('Quantity must use no more than three decimal places.')
  }
}

function deriveCustomerPurchaseAmountPkr(quantityKg: number, ratePerKgPkr: number): number {
  try {
    return calculateCustomerPurchaseAmountPkr(quantityKg, ratePerKgPkr)
  } catch (error) {
    if (error instanceof Error) throw new InvalidTransactionError(error.message)
    throw new InvalidTransactionError('Customer purchase amount is invalid.')
  }
}

function assertNoActiveOpeningBalance(transactions: CustomerLedgerTransaction[], customerId: EntityId) {
  if (transactions.some(transaction =>
    transaction.customerId === customerId
    && transaction.type === 'opening_balance'
    && transaction.status === 'active')) {
    throw new InvalidTransactionError('Customer already has an active opening balance.')
  }
}

export function sortCustomerLedgerTransactions(
  transactions: readonly CustomerLedgerTransaction[],
): CustomerLedgerTransaction[] {
  return [...transactions].sort(compareCustomerLedgerTransactions)
}

export function getCustomerLedgerTransactionBalanceImpactPkr(
  transaction: CustomerLedgerTransaction,
): number {
  if (transaction.status === 'voided') return 0

  switch (transaction.type) {
    case 'payment':
    case 'return':
      return -transaction.amountPkr
    case 'purchase':
    case 'opening_balance':
    case 'adjustment':
      return transaction.amountPkr
  }
}

export function getCustomerLedgerBalance(
  customerId: EntityId,
  transactions: readonly CustomerLedgerTransaction[],
): number {
  return transactions.reduce((balance, transaction) => {
    if (transaction.customerId !== customerId) return balance
    return balance + getCustomerLedgerTransactionBalanceImpactPkr(transaction)
  }, 0)
}

export function createCustomerLedgerPurchase(
  state: CustomerLedgerData,
  input: CreateCustomerLedgerPurchaseInput,
  options: OperationOptions = {},
): CustomerLedgerOperationResult<CustomerPurchaseTransaction> {
  assertRequiredId(input.saleId, 'Sale ID')
  assertRequiredId(input.stockLocationId, 'Stock location')
  assertTeaType(input.teaType)
  assertPurchaseQuantity(input.quantityKg)
  assertNonNegativePkr(input.ratePerKgPkr, 'Rate per kilogram')

  const transaction: CustomerPurchaseTransaction = {
    ...createBaseFields(state, input, 'customer-ledger', options),
    type: 'purchase',
    saleId: input.saleId,
    teaType: input.teaType,
    stockLocationId: input.stockLocationId,
    quantityKg: input.quantityKg,
    ratePerKgPkr: input.ratePerKgPkr,
    amountPkr: deriveCustomerPurchaseAmountPkr(input.quantityKg, input.ratePerKgPkr),
  }

  return appendTransaction(state, transaction)
}

export function createCustomerLedgerPayment(
  state: CustomerLedgerData,
  input: CreateCustomerLedgerPaymentInput,
  options: OperationOptions = {},
): CustomerLedgerOperationResult<CustomerPaymentTransaction> {
  assertPositivePkr(input.amountPkr, 'Payment amount')
  assertPaymentMethod(input.paymentMethod)
  getActiveCustomer(state, input.customerId)

  const currentBalancePkr = getCustomerLedgerBalance(input.customerId, state.transactions)
  if (currentBalancePkr - input.amountPkr < 0) {
    throw new InvalidTransactionError('Payment cannot exceed the active customer balance.')
  }

  const transaction: CustomerPaymentTransaction = {
    ...createBaseFields(state, input, 'customer-ledger', options),
    type: 'payment',
    amountPkr: input.amountPkr,
    paymentMethod: input.paymentMethod,
  }

  return appendTransaction(state, transaction)
}

export function createCustomerLedgerOpeningBalance(
  state: CustomerLedgerData,
  input: CreateCustomerLedgerOpeningBalanceInput,
  options: OperationOptions = {},
): CustomerLedgerOperationResult<CustomerOpeningBalanceTransaction> {
  assertPositivePkr(input.amountPkr, 'Opening balance amount')
  getActiveCustomer(state, input.customerId)
  assertNoActiveOpeningBalance(state.transactions, input.customerId)

  const transaction: CustomerOpeningBalanceTransaction = {
    ...createBaseFields(state, input, 'customer-ledger', options),
    type: 'opening_balance',
    amountPkr: input.amountPkr,
  }

  return appendTransaction(state, transaction)
}

export function createCustomerLedgerAdjustment(
  state: CustomerLedgerData,
  input: CreateCustomerLedgerAdjustmentInput,
  options: OperationOptions = {},
): CustomerLedgerOperationResult<CustomerAdjustmentTransaction> {
  assertNonZeroPkr(input.amountPkr, 'Adjustment amount')
  const reason = input.reason.trim()
  if (!reason) throw new InvalidTransactionError('Adjustment reason is required.')

  const transaction: CustomerAdjustmentTransaction = {
    ...createBaseFields(state, input, 'customer-ledger', options),
    type: 'adjustment',
    amountPkr: input.amountPkr,
    reason,
  }

  return appendTransaction(state, transaction)
}

export function voidCustomerLedgerTransaction(
  state: CustomerLedgerData,
  input: VoidCustomerLedgerTransactionInput,
  options: OperationOptions = {},
): CustomerLedgerOperationResult<CustomerLedgerTransaction> {
  const existing = state.transactions.find(transaction => transaction.id === input.transactionId)
  if (!existing) throw new EntityNotFoundError('Customer ledger transaction', input.transactionId)
  if (existing.status === 'voided') throw new InvalidTransactionError('Customer ledger transaction is already voided.')

  assertRequiredId(input.voidedBy, 'Void operator')
  const voidReason = input.voidReason.trim()
  if (!voidReason) throw new InvalidTransactionError('Void reason is required.')

  const timestamp = getCurrentTimestamp(options.now)
  const transaction: CustomerLedgerTransaction = {
    ...existing,
    status: 'voided',
    updatedAt: timestamp,
    voidedAt: timestamp,
    voidedBy: input.voidedBy,
    voidReason,
  }

  return {
    transaction,
    state: {
      ...state,
      customers: [...state.customers],
      transactions: state.transactions.map(item => item.id === input.transactionId ? transaction : item),
    },
  }
}
