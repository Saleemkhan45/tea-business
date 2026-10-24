import { describe, expect, it } from 'vitest'
import { InvalidTransactionError } from '../domain/errors'
import type { Customer, CustomerLedgerData } from '../domain/customer-ledger.types'
import type { OperationOptions, PaymentMethod } from '../domain/types'
import {
  createCustomerLedgerAdjustment,
  createCustomerLedgerOpeningBalance,
  createCustomerLedgerPayment,
  createCustomerLedgerPurchase,
  getCustomerLedgerBalance,
  voidCustomerLedgerTransaction,
} from './customer-ledger.service'
import {
  selectCustomerLedgerRows,
  selectDailyPaymentBuckets,
  selectPaymentCalendarBuckets,
  selectPaymentInsight,
  selectReminderCandidates,
} from '../selectors/customer-ledger.selectors'
import { startOfDay } from '../utils/date'

const BUSINESS_ID = 'business-test'
const CUSTOMER_A_ID = 'customer-ahmed'
const CUSTOMER_B_ID = 'customer-fatima'
const USER_ID = 'user-test'
const STOCK_LOCATION_ID = 'location-swat'

const customerA: Customer = {
  id: CUSTOMER_A_ID,
  businessId: BUSINESS_ID,
  name: 'Ahmed Khan',
  phone: '+92 300 1234567',
  address: 'Mingora, Swat',
  isActive: true,
  createdAt: '2026-09-01T04:00:00.000Z',
  updatedAt: '2026-09-01T04:00:00.000Z',
}

const customerB: Customer = {
  id: CUSTOMER_B_ID,
  businessId: BUSINESS_ID,
  name: 'Fatima Traders',
  phone: '+92 321 7654321',
  address: 'University Road, Peshawar',
  isActive: true,
  createdAt: '2026-09-01T04:00:00.000Z',
  updatedAt: '2026-09-01T04:00:00.000Z',
}

function createState(): CustomerLedgerData {
  return {
    customers: [{ ...customerA }, { ...customerB }],
    transactions: [],
  }
}

function operationOptions(): OperationOptions {
  let sequence = 0
  return {
    now: startOfDay('2026-09-09'),
    idFactory: prefix => `${prefix}-test-${String(++sequence).padStart(3, '0')}`,
  }
}

function addPurchase(
  state: CustomerLedgerData,
  options: OperationOptions,
  customerId: string,
  businessDate: string,
  quantityKg: number,
  ratePerKgPkr: number,
) {
  return createCustomerLedgerPurchase(state, {
    customerId,
    businessDate,
    saleId: `sale-${customerId}-${businessDate}`,
    teaType: 'green',
    stockLocationId: STOCK_LOCATION_ID,
    quantityKg,
    ratePerKgPkr,
    createdBy: USER_ID,
    notes: null,
  }, options)
}

function addPayment(
  state: CustomerLedgerData,
  options: OperationOptions,
  customerId: string,
  businessDate: string,
  amountPkr: number,
  paymentMethod: PaymentMethod = 'cash',
) {
  return createCustomerLedgerPayment(state, {
    customerId,
    businessDate,
    amountPkr,
    paymentMethod,
    createdBy: USER_ID,
    notes: null,
  }, options)
}

function createAhmedScenario() {
  const options = operationOptions()
  let state = createState()

  state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state
  const afterFirstPayment = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 5000)
  state = afterFirstPayment.state
  state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-03', 10000, 'bank_transfer').state
  state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-08', 50, 1000).state
  state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-09', 15000, 'cheque').state

  return {
    state,
    firstPaymentId: afterFirstPayment.transaction.id,
  }
}

describe('customer ledger service operations', () => {
  it('derives a customer purchase amount from quantity and rate', () => {
    const options = operationOptions()
    const inputWithCallerAmount = {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      saleId: 'sale-ahmed-001',
      teaType: 'green' as const,
      stockLocationId: STOCK_LOCATION_ID,
      quantityKg: 100,
      ratePerKgPkr: 1000,
      amountPkr: 1,
      createdBy: USER_ID,
      notes: 'Caller amount must not be trusted.',
    }

    const result = createCustomerLedgerPurchase(createState(), inputWithCallerAmount, options)

    expect(result.transaction.amountPkr).toBe(100000)
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, result.state.transactions)).toBe(100000)
  })

  it('reconciles purchases, payments, repeat purchase, and final payment', () => {
    const options = operationOptions()
    let state = createState()

    state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(100000)

    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 5000).state
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(95000)

    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-03', 10000).state
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(85000)

    state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-08', 50, 1000).state
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(135000)

    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-09', 15000).state
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(120000)
  })

  it('rejects overpayments and keeps the previous state unchanged', () => {
    const options = operationOptions()
    const state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state

    expect(() => addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 100001)).toThrow(InvalidTransactionError)
    expect(state.transactions).toHaveLength(1)
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(100000)
  })

  it('creates opening balances once and controlled adjustments with reasons', () => {
    const options = operationOptions()
    let state = createCustomerLedgerOpeningBalance(createState(), {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      amountPkr: 100000,
      createdBy: USER_ID,
      notes: null,
    }, options).state

    expect(() => createCustomerLedgerOpeningBalance(state, {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-02',
      amountPkr: 50000,
      createdBy: USER_ID,
      notes: null,
    }, options)).toThrow(InvalidTransactionError)

    state = createCustomerLedgerAdjustment(state, {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-03',
      amountPkr: 5000,
      reason: 'Approved debit correction.',
      createdBy: USER_ID,
      notes: null,
    }, options).state
    state = createCustomerLedgerAdjustment(state, {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-04',
      amountPkr: -1000,
      reason: 'Approved pricing correction.',
      createdBy: USER_ID,
      notes: null,
    }, options).state

    expect(() => createCustomerLedgerAdjustment(state, {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-05',
      amountPkr: -1000,
      reason: '   ',
      createdBy: USER_ID,
      notes: null,
    }, options)).toThrow(InvalidTransactionError)
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(104000)
  })

  it('voids transactions without deleting them from history', () => {
    const options = operationOptions()
    const created = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 100, 1000)
    const originalTransaction = created.transaction
    const voided = voidCustomerLedgerTransaction(created.state, {
      transactionId: originalTransaction.id,
      voidedBy: USER_ID,
      voidReason: 'Duplicate credit sale.',
    }, options)

    expect(originalTransaction.status).toBe('active')
    expect(voided.transaction.status).toBe('voided')
    expect(voided.transaction.voidReason).toBe('Duplicate credit sale.')
    expect(voided.state.transactions).toHaveLength(1)
    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, voided.state.transactions)).toBe(0)
  })

  it('keeps customer balances isolated', () => {
    const options = operationOptions()
    let state = createState()

    state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 5000).state
    state = addPurchase(state, options, CUSTOMER_B_ID, '2026-09-03', 50, 1000).state

    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(95000)
    expect(getCustomerLedgerBalance(CUSTOMER_B_ID, state.transactions)).toBe(50000)
  })
})

describe('customer ledger selectors', () => {
  it('calculates deterministic running balances by business date, created time, then ID', () => {
    const { state } = createAhmedScenario()

    expect(selectCustomerLedgerRows(state.transactions, CUSTOMER_A_ID).map(row => ({
      date: row.businessDate,
      type: row.type,
      impact: row.balanceImpactPkr,
      running: row.runningBalancePkr,
    }))).toEqual([
      { date: '2026-09-01', type: 'purchase', impact: 100000, running: 100000 },
      { date: '2026-09-02', type: 'payment', impact: -5000, running: 95000 },
      { date: '2026-09-03', type: 'payment', impact: -10000, running: 85000 },
      { date: '2026-09-08', type: 'purchase', impact: 50000, running: 135000 },
      { date: '2026-09-09', type: 'payment', impact: -15000, running: 120000 },
    ])
  })

  it('generates zero-payment days from the requested calendar range', () => {
    const options = operationOptions()
    let state = createCustomerLedgerOpeningBalance(createState(), {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      amountPkr: 100000,
      createdBy: USER_ID,
      notes: null,
    }, options).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-01', 5000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-03', 10000).state

    expect(selectDailyPaymentBuckets(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    }, CUSTOMER_A_ID)).toEqual([
      { date: '2026-09-01', amountPkr: 5000, transactionCount: 1 },
      { date: '2026-09-02', amountPkr: 0, transactionCount: 0 },
      { date: '2026-09-03', amountPkr: 10000, transactionCount: 1 },
    ])
  })

  it('calculates highest day, daily average, payment average, and frequency interval', () => {
    const options = operationOptions()
    let state = createCustomerLedgerOpeningBalance(createState(), {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      amountPkr: 100000,
      createdBy: USER_ID,
      notes: null,
    }, options).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-01', 5000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 20000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-03', 5000).state

    const insight = selectPaymentInsight(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    }, '2026-09-09', getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions), CUSTOMER_A_ID)

    expect(insight.highestPaymentDay).toEqual({ date: '2026-09-02', amountPkr: 20000, transactionCount: 1 })
    expect(insight.averageDailyPaymentPkr).toBe(10000)
    expect(insight.averagePaymentAmountPkr).toBe(10000)
    expect(insight.paymentDaysCount).toBe(3)
    expect(insight.paymentTransactionCount).toBe(3)
  })

  it('calculates average payment interval across payment dates', () => {
    const options = operationOptions()
    let state = createCustomerLedgerOpeningBalance(createState(), {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      amountPkr: 100000,
      createdBy: USER_ID,
      notes: null,
    }, options).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-01', 5000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-04', 5000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-08', 5000).state

    const insight = selectPaymentInsight(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-08',
    }, '2026-09-09', getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions), CUSTOMER_A_ID)

    expect(insight.averagePaymentIntervalDays).toBe(3.5)
  })

  it('excludes voided payments from balances, payment totals, highest day, and frequency', () => {
    const options = operationOptions()
    let state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-01', 20000).state
    const voidedPayment = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 50000)
    state = voidedPayment.state
    state = voidCustomerLedgerTransaction(state, {
      transactionId: voidedPayment.transaction.id,
      voidedBy: USER_ID,
      voidReason: 'Duplicate payment entry.',
    }, options).state

    const buckets = selectDailyPaymentBuckets(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-02',
    }, CUSTOMER_A_ID)
    const insight = selectPaymentInsight(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-02',
    }, '2026-09-09', getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions), CUSTOMER_A_ID)

    expect(getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions)).toBe(80000)
    expect(buckets).toEqual([
      { date: '2026-09-01', amountPkr: 20000, transactionCount: 1 },
      { date: '2026-09-02', amountPkr: 0, transactionCount: 0 },
    ])
    expect(insight.highestPaymentDay).toEqual({ date: '2026-09-01', amountPkr: 20000, transactionCount: 1 })
    expect(insight.paymentDaysCount).toBe(1)
    expect(insight.paymentTransactionCount).toBe(1)
  })

  it('represents insufficient payment history without fabricated insight values', () => {
    const options = operationOptions()
    const state = createCustomerLedgerOpeningBalance(createState(), {
      customerId: CUSTOMER_A_ID,
      businessDate: '2026-09-01',
      amountPkr: 100000,
      createdBy: USER_ID,
      notes: null,
    }, options).state

    const insight = selectPaymentInsight(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    }, '2026-09-09', getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions), CUSTOMER_A_ID)

    expect(insight).toMatchObject({
      highestPaymentDay: null,
      zeroPaymentDays: 3,
      averageDailyPaymentPkr: null,
      averagePaymentAmountPkr: null,
      paymentDaysCount: 0,
      paymentTransactionCount: 0,
      lastPaymentDate: null,
      daysSinceLastPayment: null,
      averagePaymentIntervalDays: null,
      estimatedDaysToClear: null,
    })
  })

  it('returns zero estimated days to clear when the active balance is zero', () => {
    const options = operationOptions()
    let state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 10, 1000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 10000).state

    const insight = selectPaymentInsight(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    }, '2026-09-09', getCustomerLedgerBalance(CUSTOMER_A_ID, state.transactions), CUSTOMER_A_ID)

    expect(insight.estimatedDaysToClear).toBe(0)
  })

  it('selects a customer with balance and payment history when the threshold is exceeded', () => {
    const options = operationOptions()
    let state = createState()
    state = addPurchase(state, options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-01', 5000).state

    expect(selectReminderCandidates(state.customers, state.transactions, '2026-09-09', 7)).toEqual([
      {
        customerId: CUSTOMER_A_ID,
        customerName: 'Ahmed Khan',
        balanceDuePkr: 95000,
        lastPaymentDate: '2026-09-01',
        daysSinceLastPayment: 8,
        thresholdDays: 7,
      },
    ])
  })

  it('selects a customer with balance and no payment history when the outstanding threshold is exceeded', () => {
    const options = operationOptions()
    const state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 100, 1000).state

    expect(selectReminderCandidates(state.customers, state.transactions, '2026-09-09', 7)).toEqual([
      {
        customerId: CUSTOMER_A_ID,
        customerName: 'Ahmed Khan',
        balanceDuePkr: 100000,
        lastPaymentDate: null,
        daysSinceLastPayment: null,
        thresholdDays: 7,
      },
    ])
  })

  it('does not select a customer with balance and no payment history before the outstanding threshold', () => {
    const options = operationOptions()
    const state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-05', 100, 1000).state

    expect(selectReminderCandidates(state.customers, state.transactions, '2026-09-09', 7)).toEqual([])
  })

  it('does not select a customer with zero balance', () => {
    const options = operationOptions()
    let state = addPurchase(createState(), options, CUSTOMER_A_ID, '2026-09-01', 10, 1000).state
    state = addPayment(state, options, CUSTOMER_A_ID, '2026-09-02', 10000).state

    expect(selectReminderCandidates(state.customers, state.transactions, '2026-09-09', 1)).toEqual([])
  })

  it('creates payment calendar levels from valid payment buckets', () => {
    const { state } = createAhmedScenario()

    expect(selectPaymentCalendarBuckets(state.transactions, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    }, CUSTOMER_A_ID).map(bucket => bucket.level)).toEqual(['none', 'medium', 'high'])
  })
})
