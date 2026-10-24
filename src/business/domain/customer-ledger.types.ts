import type { BusinessDate, EntityId, IsoTimestamp, PaymentMethod, TeaType } from './types'

export const CUSTOMER_LEDGER_TRANSACTION_TYPES = ['purchase', 'payment', 'opening_balance', 'adjustment', 'return'] as const
export type LedgerTeaType = TeaType | 'jasmine' | 'herbal' | 'other'
export type CustomerLedgerTransactionType = (typeof CUSTOMER_LEDGER_TRANSACTION_TYPES)[number]

export const CUSTOMER_LEDGER_TRANSACTION_STATUSES = ['active', 'voided'] as const
export type CustomerLedgerTransactionStatus = (typeof CUSTOMER_LEDGER_TRANSACTION_STATUSES)[number]

export type Customer = {
  id: EntityId
  businessId: EntityId
  name: string
  phone: string
  address: string
  isActive: boolean
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

type CustomerLedgerTransactionBase = {
  id: EntityId
  businessId: EntityId
  customerId: EntityId
  businessDate: BusinessDate
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  createdBy: EntityId
  notes: string | null
  enteredByName?: string
  productName?: string
  salePaymentMethod?: string
  reference?: string
  reversalOf?: EntityId
  saleId?: EntityId
}

type ActiveTransactionState = {
  status: 'active'
  voidedAt?: null
  voidedBy?: null
  voidReason?: null
}

type VoidedTransactionState = {
  status: 'voided'
  voidedAt: IsoTimestamp
  voidedBy: EntityId
  voidReason: string
}

type TransactionAuditState = ActiveTransactionState | VoidedTransactionState

export type CustomerPurchaseTransaction = CustomerLedgerTransactionBase & TransactionAuditState & {
  type: 'purchase'
  saleId: EntityId
  teaType: LedgerTeaType
  stockLocationId: EntityId
  quantityKg: number
  ratePerKgPkr: number
  amountPkr: number
}

export type CustomerPaymentTransaction = CustomerLedgerTransactionBase & TransactionAuditState & {
  type: 'payment'
  amountPkr: number
  paymentMethod: PaymentMethod
}

export type CustomerOpeningBalanceTransaction = CustomerLedgerTransactionBase & TransactionAuditState & {
  type: 'opening_balance'
  amountPkr: number
}

/** Controlled accounting operation. Future writes require authorization and audit logging. */
export type CustomerAdjustmentTransaction = CustomerLedgerTransactionBase & TransactionAuditState & {
  type: 'adjustment'
  amountPkr: number
  reason: string
}

export type CustomerLedgerTransaction =
  | CustomerPurchaseTransaction
  | CustomerPaymentTransaction
  | CustomerOpeningBalanceTransaction
  | CustomerAdjustmentTransaction
  | CustomerReturnTransaction

export type CustomerReturnTransaction = CustomerLedgerTransactionBase & TransactionAuditState & {
  type: 'return'
  saleId: EntityId
  reversalOf: EntityId
  amountPkr: number
  teaType: LedgerTeaType
  quantityKg: number
  ratePerKgPkr: number
}

export type CustomerSummary = {
  customerId: EntityId
  totalPurchasedKg: number
  totalPurchasedPkr: number
  totalPaidPkr: number
  openingBalancePkr?: number
  currentBalancePkr: number
  purchaseCount: number
  lastPurchaseDate: BusinessDate | null
  productSummary: CustomerProductSummary[]
  todayPurchasedPkr?: number
  todayPaidPkr?: number
  lastPaymentDate: BusinessDate | null
  daysSinceLastPayment: number | null
}

export type CustomerProductSummary = {
  productName: string
  teaType: LedgerTeaType | null
  totalQuantityKg: number
  totalSpendingPkr: number
  purchaseCount: number
  lastPurchaseDate: BusinessDate | null
}

export type LedgerRow = {
  transactionId: EntityId
  businessDate: BusinessDate
  type: CustomerLedgerTransactionType
  teaType: LedgerTeaType | null
  quantityKg: number | null
  ratePerKgPkr: number | null
  amountPkr: number
  balanceImpactPkr: number
  paymentMethod: PaymentMethod | null
  runningBalancePkr: number
  status: CustomerLedgerTransactionStatus
  createdBy: EntityId
  createdAt: IsoTimestamp
}

export type DailyPaymentBucket = {
  date: BusinessDate
  amountPkr: number
  transactionCount: number
}

export type PaymentInsight = {
  highestPaymentDay: DailyPaymentBucket | null
  zeroPaymentDays: number
  averageDailyPaymentPkr: number | null
  averagePaymentAmountPkr: number | null
  paymentDaysCount: number
  paymentTransactionCount: number
  lastPaymentDate: BusinessDate | null
  daysSinceLastPayment: number | null
  averagePaymentIntervalDays: number | null
  estimatedDaysToClear: number | null
}

export type PaymentCalendarLevel = 'no_data' | 'none' | 'low' | 'medium' | 'high'

export type PaymentCalendarBucket = DailyPaymentBucket & {
  level: PaymentCalendarLevel
}

export type ReminderCandidate = {
  customerId: EntityId
  customerName: string
  balanceDuePkr: number
  lastPaymentDate: BusinessDate | null
  daysSinceLastPayment: number | null
  thresholdDays: number
}

export type CustomerLedgerSeedData = {
  customers: Customer[]
  transactions: CustomerLedgerTransaction[]
}

export type CustomerLedgerData = CustomerLedgerSeedData

export const CUSTOMER_LEDGER_ORDER = ['businessDate', 'createdAt', 'id'] as const

export function hasSupportedQuantityPrecision(quantityKg: number): boolean {
  if (!Number.isFinite(quantityKg)) return false
  const quantityGrams = Math.round(quantityKg * 1000)
  return Number.isSafeInteger(quantityGrams)
    && Math.abs(quantityKg - (quantityGrams / 1000)) < 1e-9
}

export function compareCustomerLedgerTransactions(
  first: CustomerLedgerTransaction,
  second: CustomerLedgerTransaction,
): number {
  return first.businessDate.localeCompare(second.businessDate)
    || first.createdAt.localeCompare(second.createdAt)
    || first.id.localeCompare(second.id)
}

export function calculateCustomerPurchaseAmountPkr(quantityKg: number, ratePerKgPkr: number): number {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new RangeError('Quantity must be greater than zero.')
  }
  if (!Number.isSafeInteger(ratePerKgPkr) || ratePerKgPkr < 0) {
    throw new RangeError('Rate per kilogram must be a non-negative integer PKR amount.')
  }

  if (!hasSupportedQuantityPrecision(quantityKg)) {
    throw new RangeError('Quantity must use no more than three decimal places.')
  }

  const quantityGrams = Math.round(quantityKg * 1000)
  const amountInThousandths = quantityGrams * ratePerKgPkr
  if (!Number.isSafeInteger(amountInThousandths) || amountInThousandths % 1000 !== 0) {
    throw new RangeError('Quantity and rate must produce a whole PKR amount.')
  }
  return amountInThousandths / 1000
}
