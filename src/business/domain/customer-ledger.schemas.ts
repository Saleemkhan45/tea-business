import { z } from 'zod'
import { isValidBusinessDate } from '../utils/date'
import { PAYMENT_METHODS } from './types'
import {
  CUSTOMER_LEDGER_TRANSACTION_STATUSES,
  CUSTOMER_LEDGER_TRANSACTION_TYPES,
  hasSupportedQuantityPrecision,
} from './customer-ledger.types'
import type {
  CreateAdjustmentResponse,
  CreateAdjustmentRequest,
  CreateCustomerPaymentResponse,
  CreateCustomerPaymentRequest,
  CreateCustomerPurchaseResponse,
  CreateCustomerPurchaseRequest,
  CreateCustomerResponse,
  CreateCustomerRequest,
  CreateOpeningBalanceResponse,
  CreateOpeningBalanceRequest,
  CustomerLedgerResponse,
  CustomerSummaryResponse,
  DailyPaymentsResponse,
  PaymentCalendarResponse,
  ReminderCandidatesResponse,
  UpdateCustomerResponse,
  UpdateCustomerRequest,
} from './customer-ledger.contracts'
import type {
  Customer,
  CustomerAdjustmentTransaction,
  CustomerLedgerTransaction,
  CustomerOpeningBalanceTransaction,
  CustomerPaymentTransaction,
  CustomerProductSummary,
  CustomerPurchaseTransaction,
  CustomerReturnTransaction,
  CustomerSummary,
  DailyPaymentBucket,
  LedgerRow,
  PaymentCalendarBucket,
  PaymentInsight,
  ReminderCandidate,
} from './customer-ledger.types'

export const customerLedgerTransactionTypeSchema = z.enum(CUSTOMER_LEDGER_TRANSACTION_TYPES)
export const customerLedgerTransactionStatusSchema = z.enum(CUSTOMER_LEDGER_TRANSACTION_STATUSES)
export const customerPaymentMethodSchema = z.enum(PAYMENT_METHODS)

export const entityIdSchema = z.string().trim().min(1, 'ID is required.').max(120)
export const businessDateSchema = z.string().refine(isValidBusinessDate, 'Business date must be a valid YYYY-MM-DD date.')
export const isoTimestampSchema = z.string().datetime({ offset: true })

const requiredTextSchema = z.string().trim().min(1).max(160)
const notesSchema = z.string().trim().max(500).nullable()
const integerPkrSchema = z.number().int('PKR amounts must be integers.').refine(Number.isSafeInteger, 'PKR amount is outside the safe integer range.')
const nonNegativeIntegerPkrSchema = integerPkrSchema.min(0)
const positiveIntegerPkrSchema = integerPkrSchema.positive()
const nonZeroIntegerPkrSchema = integerPkrSchema.refine(value => value !== 0, 'Adjustment amount must not be zero.')
const quantityKgSchema = z.number().finite().positive().refine(
  hasSupportedQuantityPrecision,
  'Quantity must use no more than three decimal places.',
)

export const customerSchema: z.ZodType<Customer> = z.object({
  id: entityIdSchema,
  businessId: entityIdSchema,
  name: requiredTextSchema,
  phone: z.string().trim().min(7).max(25),
  address: z.string().trim().min(2).max(240),
  isActive: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict()

const transactionBaseShape = {
  id: entityIdSchema,
  businessId: entityIdSchema,
  customerId: entityIdSchema,
  businessDate: businessDateSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  createdBy: entityIdSchema,
  notes: notesSchema,
  enteredByName: z.string().optional(), productName: z.string().optional(),
  salePaymentMethod: z.string().optional(),
  reference: z.string().max(120).optional(), reversalOf: entityIdSchema.optional(), saleId: entityIdSchema.optional(),
}

const activeStateShape = {
  status: z.literal('active'),
  voidedAt: z.null().optional(),
  voidedBy: z.null().optional(),
  voidReason: z.null().optional(),
}

const voidedStateShape = {
  status: z.literal('voided'),
  voidedAt: isoTimestampSchema,
  voidedBy: entityIdSchema,
  voidReason: z.string().trim().min(1).max(240),
}

const purchaseShape = {
  type: z.literal('purchase'),
  saleId: entityIdSchema,
  teaType: z.enum(['green', 'black', 'jasmine', 'herbal', 'other']),
  stockLocationId: entityIdSchema,
  quantityKg: quantityKgSchema,
  ratePerKgPkr: nonNegativeIntegerPkrSchema,
  amountPkr: nonNegativeIntegerPkrSchema,
}

const paymentShape = {
  type: z.literal('payment'),
  amountPkr: positiveIntegerPkrSchema,
  paymentMethod: customerPaymentMethodSchema,
}

const openingBalanceShape = {
  type: z.literal('opening_balance'),
  amountPkr: positiveIntegerPkrSchema,
}

const adjustmentShape = {
  type: z.literal('adjustment'),
  amountPkr: nonZeroIntegerPkrSchema,
  reason: z.string().trim().min(1).max(240),
}

export const customerPurchaseTransactionSchema: z.ZodType<CustomerPurchaseTransaction> = z.union([
  z.object({ ...transactionBaseShape, ...purchaseShape, ...activeStateShape }).strict(),
  z.object({ ...transactionBaseShape, ...purchaseShape, ...voidedStateShape }).strict(),
])

export const customerPaymentTransactionSchema: z.ZodType<CustomerPaymentTransaction> = z.union([
  z.object({ ...transactionBaseShape, ...paymentShape, ...activeStateShape }).strict(),
  z.object({ ...transactionBaseShape, ...paymentShape, ...voidedStateShape }).strict(),
])

export const customerOpeningBalanceTransactionSchema: z.ZodType<CustomerOpeningBalanceTransaction> = z.union([
  z.object({ ...transactionBaseShape, ...openingBalanceShape, ...activeStateShape }).strict(),
  z.object({ ...transactionBaseShape, ...openingBalanceShape, ...voidedStateShape }).strict(),
])

export const customerAdjustmentTransactionSchema: z.ZodType<CustomerAdjustmentTransaction> = z.union([
  z.object({ ...transactionBaseShape, ...adjustmentShape, ...activeStateShape }).strict(),
  z.object({ ...transactionBaseShape, ...adjustmentShape, ...voidedStateShape }).strict(),
])

export const customerLedgerTransactionSchema: z.ZodType<CustomerLedgerTransaction> = z.union([
  customerPurchaseTransactionSchema,
  customerPaymentTransactionSchema,
  customerOpeningBalanceTransactionSchema,
  customerAdjustmentTransactionSchema,
  z.object({ ...transactionBaseShape, ...purchaseShape, type: z.literal('return'), reversalOf: entityIdSchema, ...activeStateShape }).strict() as z.ZodType<CustomerReturnTransaction>,
])

export const createCustomerRequestSchema: z.ZodType<CreateCustomerRequest> = z.object({
  name: requiredTextSchema,
  phone: z.string().trim().min(7).max(25),
  address: z.string().trim().min(2).max(240),
  isActive: z.boolean().optional(),
}).strict()

export const updateCustomerRequestSchema: z.ZodType<UpdateCustomerRequest> = z.object({
  customerId: entityIdSchema,
  name: requiredTextSchema.optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  address: z.string().trim().min(2).max(240).optional(),
  isActive: z.boolean().optional(),
}).strict().refine(
  request => request.name !== undefined
    || request.phone !== undefined
    || request.address !== undefined
    || request.isActive !== undefined,
  'At least one customer field must be provided.',
)

const transactionRequestShape = {
  customerId: entityIdSchema,
  businessDate: businessDateSchema,
  notes: notesSchema.optional(),
}

export const createCustomerPurchaseRequestSchema: z.ZodType<CreateCustomerPurchaseRequest> = z.object({
  ...transactionRequestShape,
  saleId: entityIdSchema,
  teaType: z.enum(['green', 'black']),
  stockLocationId: entityIdSchema,
  quantityKg: quantityKgSchema,
  ratePerKgPkr: nonNegativeIntegerPkrSchema,
}).strict()

export const createCustomerPaymentRequestSchema: z.ZodType<CreateCustomerPaymentRequest> = z.object({
  ...transactionRequestShape,
  amountPkr: positiveIntegerPkrSchema,
  paymentMethod: customerPaymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
}).strict()

export const createOpeningBalanceRequestSchema: z.ZodType<CreateOpeningBalanceRequest> = z.object({
  ...transactionRequestShape,
  amountPkr: positiveIntegerPkrSchema,
}).strict()

export const createAdjustmentRequestSchema: z.ZodType<CreateAdjustmentRequest> = z.object({
  ...transactionRequestShape,
  amountPkr: nonZeroIntegerPkrSchema,
  reason: z.string().trim().min(1).max(240),
}).strict()

export const customerSummarySchema: z.ZodType<CustomerSummary> = z.object({
  customerId: entityIdSchema,
  totalPurchasedKg: z.number().finite().nonnegative(),
  totalPurchasedPkr: nonNegativeIntegerPkrSchema,
  totalPaidPkr: nonNegativeIntegerPkrSchema,
  currentBalancePkr: integerPkrSchema,
  purchaseCount: z.number().int().nonnegative(),
  lastPurchaseDate: businessDateSchema.nullable(),
  productSummary: z.array(z.object({
    productName: z.string().trim().min(1).max(240),
    teaType: z.enum(['green', 'black', 'jasmine', 'herbal', 'other']).nullable(),
    totalQuantityKg: z.number().finite().nonnegative(),
    totalSpendingPkr: nonNegativeIntegerPkrSchema,
    purchaseCount: z.number().int().nonnegative(),
    lastPurchaseDate: businessDateSchema.nullable(),
  }).strict() as z.ZodType<CustomerProductSummary>),
  todayPurchasedPkr: nonNegativeIntegerPkrSchema.optional(), todayPaidPkr: nonNegativeIntegerPkrSchema.optional(),
  lastPaymentDate: businessDateSchema.nullable(),
  daysSinceLastPayment: z.number().int().nonnegative().nullable(),
}).strict()

export const ledgerRowSchema: z.ZodType<LedgerRow> = z.object({
  transactionId: entityIdSchema,
  businessDate: businessDateSchema,
  type: customerLedgerTransactionTypeSchema,
  teaType: z.enum(['green', 'black', 'jasmine', 'herbal', 'other']).nullable(),
  quantityKg: quantityKgSchema.nullable(),
  ratePerKgPkr: nonNegativeIntegerPkrSchema.nullable(),
  amountPkr: integerPkrSchema,
  balanceImpactPkr: integerPkrSchema,
  paymentMethod: customerPaymentMethodSchema.nullable(),
  runningBalancePkr: integerPkrSchema,
  status: customerLedgerTransactionStatusSchema,
  createdBy: entityIdSchema,
  createdAt: isoTimestampSchema,
}).strict()

export const dailyPaymentBucketSchema: z.ZodType<DailyPaymentBucket> = z.object({
  date: businessDateSchema,
  amountPkr: nonNegativeIntegerPkrSchema,
  transactionCount: z.number().int().nonnegative(),
}).strict()

export const paymentInsightSchema: z.ZodType<PaymentInsight> = z.object({
  highestPaymentDay: dailyPaymentBucketSchema.nullable(),
  zeroPaymentDays: z.number().int().nonnegative(),
  averageDailyPaymentPkr: nonNegativeIntegerPkrSchema.nullable(),
  averagePaymentAmountPkr: nonNegativeIntegerPkrSchema.nullable(),
  paymentDaysCount: z.number().int().nonnegative(),
  paymentTransactionCount: z.number().int().nonnegative(),
  lastPaymentDate: businessDateSchema.nullable(),
  daysSinceLastPayment: z.number().int().nonnegative().nullable(),
  averagePaymentIntervalDays: z.number().nonnegative().nullable(),
  estimatedDaysToClear: z.number().nonnegative().nullable(),
}).strict()

export const paymentCalendarBucketSchema: z.ZodType<PaymentCalendarBucket> = z.object({
  date: businessDateSchema,
  amountPkr: nonNegativeIntegerPkrSchema,
  transactionCount: z.number().int().nonnegative(),
  level: z.enum(['no_data', 'none', 'low', 'medium', 'high']),
}).strict()

export const reminderCandidateSchema: z.ZodType<ReminderCandidate> = z.object({
  customerId: entityIdSchema,
  customerName: requiredTextSchema,
  balanceDuePkr: positiveIntegerPkrSchema,
  lastPaymentDate: businessDateSchema.nullable(),
  daysSinceLastPayment: z.number().int().nonnegative().nullable(),
  thresholdDays: z.number().int().positive(),
}).strict()

export const createCustomerResponseSchema: z.ZodType<CreateCustomerResponse> = z.object({ customer: customerSchema }).strict()
export const updateCustomerResponseSchema: z.ZodType<UpdateCustomerResponse> = z.object({ customer: customerSchema }).strict()
export const createCustomerPurchaseResponseSchema: z.ZodType<CreateCustomerPurchaseResponse> = z.object({ transaction: customerPurchaseTransactionSchema }).strict()
export const createCustomerPaymentResponseSchema: z.ZodType<CreateCustomerPaymentResponse> = z.object({ transaction: customerPaymentTransactionSchema }).strict()
export const createOpeningBalanceResponseSchema: z.ZodType<CreateOpeningBalanceResponse> = z.object({ transaction: customerOpeningBalanceTransactionSchema }).strict()
export const createAdjustmentResponseSchema: z.ZodType<CreateAdjustmentResponse> = z.object({ transaction: customerAdjustmentTransactionSchema }).strict()

export const customerSummaryResponseSchema: z.ZodType<CustomerSummaryResponse> = z.object({
  customer: customerSchema,
  summary: customerSummarySchema,
  paymentInsight: paymentInsightSchema,
}).strict()

export const customerLedgerResponseSchema: z.ZodType<CustomerLedgerResponse> = z.object({
  customerId: entityIdSchema,
  transactions: z.array(customerLedgerTransactionSchema),
  rows: z.array(ledgerRowSchema),
}).strict()

export const dailyPaymentsResponseSchema: z.ZodType<DailyPaymentsResponse> = z.object({
  customerId: entityIdSchema,
  startDate: businessDateSchema,
  endDate: businessDateSchema,
  buckets: z.array(dailyPaymentBucketSchema),
}).strict()

export const paymentCalendarResponseSchema: z.ZodType<PaymentCalendarResponse> = z.object({
  customerId: entityIdSchema,
  startDate: businessDateSchema,
  endDate: businessDateSchema,
  buckets: z.array(paymentCalendarBucketSchema),
}).strict()

export const reminderCandidatesResponseSchema: z.ZodType<ReminderCandidatesResponse> = z.object({
  businessDate: businessDateSchema,
  candidates: z.array(reminderCandidateSchema),
}).strict()
