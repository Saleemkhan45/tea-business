import type { BusinessDate, EntityId, PaymentMethod, TeaType } from './types'
import type {
  Customer,
  CustomerAdjustmentTransaction,
  CustomerLedgerTransaction,
  CustomerOpeningBalanceTransaction,
  CustomerPaymentTransaction,
  CustomerPurchaseTransaction,
  CustomerSummary,
  DailyPaymentBucket,
  LedgerRow,
  PaymentCalendarBucket,
  PaymentInsight,
  ReminderCandidate,
} from './customer-ledger.types'

export type CreateCustomerRequest = {
  name: string
  phone: string
  address: string
  isActive?: boolean
}

export type UpdateCustomerRequest = {
  customerId: EntityId
  name?: string
  phone?: string
  address?: string
  isActive?: boolean
}

type CustomerTransactionRequestBase = {
  customerId: EntityId
  businessDate: BusinessDate
  notes?: string | null
}

export type CreateCustomerPurchaseRequest = CustomerTransactionRequestBase & {
  saleId: EntityId
  teaType: TeaType
  stockLocationId: EntityId
  quantityKg: number
  ratePerKgPkr: number
}

export type CreateCustomerPaymentRequest = CustomerTransactionRequestBase & {
  amountPkr: number
  paymentMethod: PaymentMethod
  reference?: string
}

export type CreateOpeningBalanceRequest = CustomerTransactionRequestBase & {
  amountPkr: number
}

export type CreateAdjustmentRequest = CustomerTransactionRequestBase & {
  amountPkr: number
  reason: string
}

export type CreateCustomerResponse = { customer: Customer }
export type UpdateCustomerResponse = { customer: Customer }
export type CreateCustomerPurchaseResponse = { transaction: CustomerPurchaseTransaction }
export type CreateCustomerPaymentResponse = { transaction: CustomerPaymentTransaction }
export type CreateOpeningBalanceResponse = { transaction: CustomerOpeningBalanceTransaction }
export type CreateAdjustmentResponse = { transaction: CustomerAdjustmentTransaction }

export type CustomerSummaryResponse = {
  customer: Customer
  summary: CustomerSummary
  paymentInsight: PaymentInsight
}

export type CustomerLedgerResponse = {
  customerId: EntityId
  transactions: CustomerLedgerTransaction[]
  rows: LedgerRow[]
}

export type DailyPaymentsResponse = {
  customerId: EntityId
  startDate: BusinessDate
  endDate: BusinessDate
  buckets: DailyPaymentBucket[]
}

export type PaymentCalendarResponse = {
  customerId: EntityId
  startDate: BusinessDate
  endDate: BusinessDate
  buckets: PaymentCalendarBucket[]
}

export type ReminderCandidatesResponse = {
  businessDate: BusinessDate
  candidates: ReminderCandidate[]
}
