import { describe, expect, it } from 'vitest'
import { createCustomerLedgerSeed, customerLedgerSeedIds } from '../data/customer-ledger.seed'
import { seedIds } from '../data/seed'
import { shiftBusinessDate } from '../utils/date'
import {
  businessDateSchema,
  createCustomerPaymentRequestSchema,
  createCustomerPurchaseRequestSchema,
  customerAdjustmentTransactionSchema,
  customerLedgerTransactionSchema,
  customerOpeningBalanceTransactionSchema,
  customerPaymentTransactionSchema,
  customerPurchaseTransactionSchema,
  customerSchema,
} from './customer-ledger.schemas'
import {
  calculateCustomerPurchaseAmountPkr,
  compareCustomerLedgerTransactions,
} from './customer-ledger.types'
import type {
  CustomerAdjustmentTransaction,
  CustomerOpeningBalanceTransaction,
  CustomerPaymentTransaction,
  CustomerPurchaseTransaction,
} from './customer-ledger.types'

const TEST_DATE = '2026-09-30'
const TEST_TIMESTAMP = '2026-09-30T07:00:00.000Z'

const validCustomer = {
  id: 'customer-test',
  businessId: seedIds.business,
  name: 'Ahmed Khan',
  phone: '+92 300 1234567',
  address: 'Mingora, Swat',
  isActive: true,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
}

const transactionBase = {
  id: 'ledger-test-001',
  businessId: seedIds.business,
  customerId: validCustomer.id,
  businessDate: TEST_DATE,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  createdBy: seedIds.users.admin,
  status: 'active' as const,
  notes: null,
}

const validPurchase: CustomerPurchaseTransaction = {
  ...transactionBase,
  type: 'purchase',
  saleId: 'sale-test-001',
  teaType: 'green',
  stockLocationId: seedIds.locations.swat,
  quantityKg: 100,
  ratePerKgPkr: 1000,
  amountPkr: 100000,
}

const validPayment: CustomerPaymentTransaction = {
  ...transactionBase,
  id: 'ledger-test-002',
  type: 'payment',
  amountPkr: 5000,
  paymentMethod: 'cash',
}

const validOpeningBalance: CustomerOpeningBalanceTransaction = {
  ...transactionBase,
  id: 'ledger-test-003',
  type: 'opening_balance',
  amountPkr: 25000,
}

const validAdjustment: CustomerAdjustmentTransaction = {
  ...transactionBase,
  id: 'ledger-test-004',
  type: 'adjustment',
  amountPkr: -1000,
  reason: 'Approved account correction.',
}

describe('customer ledger domain schemas', () => {
  it('accepts a valid customer', () => {
    expect(customerSchema.safeParse(validCustomer).success).toBe(true)
  })

  it('accepts valid purchase, payment, opening balance, and adjustment entries', () => {
    expect(customerPurchaseTransactionSchema.safeParse(validPurchase).success).toBe(true)
    expect(customerPaymentTransactionSchema.safeParse(validPayment).success).toBe(true)
    expect(customerOpeningBalanceTransactionSchema.safeParse(validOpeningBalance).success).toBe(true)
    expect(customerAdjustmentTransactionSchema.safeParse(validAdjustment).success).toBe(true)
  })

  it('accepts complete void metadata', () => {
    const voidedPayment = {
      ...validPayment,
      status: 'voided',
      updatedAt: '2026-09-30T08:00:00.000Z',
      voidedAt: '2026-09-30T08:00:00.000Z',
      voidedBy: seedIds.users.admin,
      voidReason: 'Duplicate payment entry.',
    }
    expect(customerPaymentTransactionSchema.safeParse(voidedPayment).success).toBe(true)
  })

  it('rejects an empty customer name', () => {
    expect(customerSchema.safeParse({ ...validCustomer, name: '   ' }).success).toBe(false)
  })

  it('rejects negative purchase quantity', () => {
    expect(customerPurchaseTransactionSchema.safeParse({ ...validPurchase, quantityKg: -1 }).success).toBe(false)
  })

  it.each([0, -5000])('rejects a payment amount of %s', amountPkr => {
    expect(customerPaymentTransactionSchema.safeParse({ ...validPayment, amountPkr }).success).toBe(false)
  })

  it('rejects decimal PKR amounts', () => {
    expect(customerPaymentTransactionSchema.safeParse({ ...validPayment, amountPkr: 5000.5 }).success).toBe(false)
  })

  it('rejects an invalid transaction type', () => {
    expect(customerLedgerTransactionSchema.safeParse({ ...validPayment, type: 'refund' }).success).toBe(false)
  })

  it('rejects an invalid transaction status', () => {
    expect(customerLedgerTransactionSchema.safeParse({ ...validPayment, status: 'deleted' }).success).toBe(false)
  })

  it('rejects an invalid payment method', () => {
    expect(customerPaymentTransactionSchema.safeParse({ ...validPayment, paymentMethod: 'crypto' }).success).toBe(false)
  })

  it('rejects a purchase without a sale ID', () => {
    expect(customerPurchaseTransactionSchema.safeParse({ ...validPurchase, saleId: undefined }).success).toBe(false)
  })

  it('rejects a transaction without a customer ID', () => {
    expect(customerLedgerTransactionSchema.safeParse({ ...validPayment, customerId: undefined }).success).toBe(false)
  })

  it('rejects an invalid business date', () => {
    expect(businessDateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(customerLedgerTransactionSchema.safeParse({ ...validPayment, businessDate: '30-09-2026' }).success).toBe(false)
  })

  it('rejects void metadata on an active transaction', () => {
    const invalidActivePayment = {
      ...validPayment,
      voidedAt: '2026-09-30T08:00:00.000Z',
      voidedBy: seedIds.users.admin,
      voidReason: 'Should not be present.',
    }
    expect(customerPaymentTransactionSchema.safeParse(invalidActivePayment).success).toBe(false)
  })

  it('rejects incomplete void metadata', () => {
    const incompleteVoid = {
      ...validPayment,
      status: 'voided',
      voidedAt: '2026-09-30T08:00:00.000Z',
      voidedBy: seedIds.users.admin,
    }
    expect(customerPaymentTransactionSchema.safeParse(incompleteVoid).success).toBe(false)
  })
})

describe('customer ledger API request contracts', () => {
  it('accepts a purchase request without a client-provided amount', () => {
    const request = {
      customerId: validCustomer.id,
      businessDate: TEST_DATE,
      saleId: 'sale-test-001',
      teaType: 'green',
      stockLocationId: seedIds.locations.swat,
      quantityKg: 100,
      ratePerKgPkr: 1000,
      notes: null,
    }
    expect(createCustomerPurchaseRequestSchema.safeParse(request).success).toBe(true)
    expect(createCustomerPurchaseRequestSchema.safeParse({ ...request, amountPkr: 1 }).success).toBe(false)
  })

  it('validates payment request amount and method', () => {
    const request = {
      customerId: validCustomer.id,
      businessDate: TEST_DATE,
      amountPkr: 5000,
      paymentMethod: 'bank_transfer',
    }
    expect(createCustomerPaymentRequestSchema.safeParse(request).success).toBe(true)
    expect(createCustomerPaymentRequestSchema.safeParse({ ...request, amountPkr: 0 }).success).toBe(false)
  })

  it('calculates the authoritative whole-PKR purchase amount', () => {
    expect(calculateCustomerPurchaseAmountPkr(100, 1000)).toBe(100000)
    expect(calculateCustomerPurchaseAmountPkr(1.001, 1000)).toBe(1001)
    expect(() => calculateCustomerPurchaseAmountPkr(0.5, 999)).toThrow('whole PKR')
  })
})

describe('customer ledger seed and ordering contracts', () => {
  it('orders transactions by business date, created time, then ID', () => {
    const laterId = { ...validPayment, id: 'ledger-b' }
    const earlierId = { ...validPayment, id: 'ledger-a' }
    const nextDay = { ...validPayment, id: 'ledger-0', businessDate: '2026-10-01' }
    const ordered = [nextDay, laterId, earlierId].sort(compareCustomerLedgerTransactions)
    expect(ordered.map(transaction => transaction.id)).toEqual(['ledger-a', 'ledger-b', 'ledger-0'])
  })

  it('contains valid deterministic data for two independent customers', () => {
    const seed = createCustomerLedgerSeed(TEST_DATE)
    expect(seed.customers).toHaveLength(2)
    expect(seed.customers.every(customer => customerSchema.safeParse(customer).success)).toBe(true)
    expect(seed.transactions.every(transaction => customerLedgerTransactionSchema.safeParse(transaction).success)).toBe(true)

    const customerIds = new Set(seed.transactions.map(transaction => transaction.customerId))
    expect(customerIds).toEqual(new Set(Object.values(customerLedgerSeedIds.customers)))
  })

  it('reconciles Ahmed Khan to PKR 120,000 without storing a derived balance', () => {
    const seed = createCustomerLedgerSeed(TEST_DATE)
    const ahmedTransactions = seed.transactions.filter(transaction =>
      transaction.customerId === customerLedgerSeedIds.customers.ahmed && transaction.status === 'active')
    const balancePkr = ahmedTransactions.reduce((balance, transaction) => {
      if (transaction.type === 'payment') return balance - transaction.amountPkr
      return balance + transaction.amountPkr
    }, 0)

    expect(ahmedTransactions.filter(transaction => transaction.type === 'purchase')).toHaveLength(2)
    expect(balancePkr).toBe(120000)
  })

  it('represents zero-payment days as calendar gaps rather than fake transactions', () => {
    const seed = createCustomerLedgerSeed(TEST_DATE)
    const expectedZeroPaymentDate = shiftBusinessDate(TEST_DATE, -5)
    const ahmedPaymentDates = seed.transactions
      .filter(transaction => transaction.customerId === customerLedgerSeedIds.customers.ahmed && transaction.type === 'payment')
      .map(transaction => transaction.businessDate)

    expect(ahmedPaymentDates).not.toContain(expectedZeroPaymentDate)
    expect(new Set(seed.transactions
      .filter(transaction => transaction.type === 'payment')
      .map(transaction => transaction.paymentMethod))).toEqual(
      new Set(['cash', 'bank_transfer', 'cheque', 'other']),
    )
  })
})
