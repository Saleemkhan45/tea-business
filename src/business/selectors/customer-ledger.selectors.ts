import type {
  BusinessDate,
  DateRange,
  EntityId,
  PaymentMethod,
} from '../domain/types'
import type {
  Customer,
  CustomerLedgerTransaction,
  CustomerProductSummary,
  CustomerSummary,
  DailyPaymentBucket,
  LedgerRow,
  PaymentCalendarBucket,
  PaymentInsight,
  ReminderCandidate,
} from '../domain/customer-ledger.types'
import {
  getCustomerLedgerBalance,
  getCustomerLedgerTransactionBalanceImpactPkr,
  sortCustomerLedgerTransactions,
} from '../services/customer-ledger.service'
import { isValidBusinessDate, shiftBusinessDate, startOfDay } from '../utils/date'

const DAY_MS = 86_400_000

function assertDateRange(dateRange: DateRange) {
  if (!isValidBusinessDate(dateRange.startDate) || !isValidBusinessDate(dateRange.endDate)) {
    throw new RangeError('Payment date range must use valid YYYY-MM-DD business dates.')
  }
  if (dateRange.startDate > dateRange.endDate) {
    throw new RangeError('Payment date range start must be on or before its end.')
  }
}

function assertBusinessDate(date: BusinessDate, label: string) {
  if (!isValidBusinessDate(date)) throw new RangeError(`${label} must be a valid YYYY-MM-DD business date.`)
}

function differenceInBusinessDays(startDate: BusinessDate, endDate: BusinessDate): number {
  assertBusinessDate(startDate, 'Start date')
  assertBusinessDate(endDate, 'End date')
  return Math.round((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / DAY_MS)
}

function datesInRange(dateRange: DateRange): BusinessDate[] {
  assertDateRange(dateRange)
  const dates: BusinessDate[] = []
  for (let date = dateRange.startDate; date <= dateRange.endDate; date = shiftBusinessDate(date, 1)) {
    dates.push(date)
  }
  return dates
}

function activePaymentTransactions(
  transactions: readonly CustomerLedgerTransaction[],
  customerId?: EntityId,
): CustomerLedgerTransaction[] {
  return transactions.filter(transaction =>
    transaction.status === 'active'
    && transaction.type === 'payment'
    && (!customerId || transaction.customerId === customerId))
}

function getPaymentDateSet(payments: readonly CustomerLedgerTransaction[]): BusinessDate[] {
  return [...new Set(payments.map(payment => payment.businessDate))].sort()
}

function getLastPaymentDate(
  transactions: readonly CustomerLedgerTransaction[],
  customerId: EntityId,
  referenceDate: BusinessDate,
): BusinessDate | null {
  const dates = getPaymentDateSet(activePaymentTransactions(transactions, customerId)
    .filter(transaction => transaction.businessDate <= referenceDate))
  return dates.at(-1) ?? null
}

function activePurchaseTransactions(
  transactions: readonly CustomerLedgerTransaction[],
  customerId: EntityId,
): Extract<CustomerLedgerTransaction, { type: 'purchase' }>[] {
  const activeTransactions = transactions.filter(transaction =>
    transaction.customerId === customerId && transaction.status === 'active')
  const reversed = new Set(activeTransactions
    .filter(transaction => transaction.reversalOf)
    .map(transaction => transaction.reversalOf))
  return activeTransactions.filter((transaction): transaction is Extract<CustomerLedgerTransaction, { type: 'purchase' }> =>
    transaction.type === 'purchase' && !reversed.has(transaction.id))
}

function selectProductSummary(purchases: readonly Extract<CustomerLedgerTransaction, { type: 'purchase' }>[]): CustomerProductSummary[] {
  const products = new Map<string, CustomerProductSummary>()
  for (const purchase of purchases) {
    const productName = purchase.productName?.trim() || `${purchase.teaType} tea`
    const key = `${purchase.teaType}:${productName.toLowerCase()}`
    const summary = products.get(key) ?? {
      productName,
      teaType: purchase.teaType,
      totalQuantityKg: 0,
      totalSpendingPkr: 0,
      purchaseCount: 0,
      lastPurchaseDate: null,
    }
    summary.totalQuantityKg += purchase.quantityKg
    summary.totalSpendingPkr += purchase.amountPkr
    summary.purchaseCount += 1
    summary.lastPurchaseDate = summary.lastPurchaseDate === null || purchase.businessDate > summary.lastPurchaseDate
      ? purchase.businessDate
      : summary.lastPurchaseDate
    products.set(key, summary)
  }
  return [...products.values()].sort((first, second) =>
    String(first.teaType ?? '').localeCompare(String(second.teaType ?? ''))
    || first.productName.localeCompare(second.productName))
}

function getEarliestActiveDebtDate(
  transactions: readonly CustomerLedgerTransaction[],
  customerId: EntityId,
  referenceDate: BusinessDate,
): BusinessDate | null {
  return sortCustomerLedgerTransactions(transactions.filter(transaction =>
    transaction.customerId === customerId
    && transaction.status === 'active'
    && transaction.businessDate <= referenceDate
    && getCustomerLedgerTransactionBalanceImpactPkr(transaction) > 0))[0]?.businessDate ?? null
}

function roundPkrAverage(totalPkr: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round(totalPkr / denominator)
}

export function selectCustomerLedgerTransactions(
  transactions: readonly CustomerLedgerTransaction[],
  customerId: EntityId,
): CustomerLedgerTransaction[] {
  return sortCustomerLedgerTransactions(transactions.filter(transaction => transaction.customerId === customerId))
}

export function selectCustomerLedgerRows(
  transactions: readonly CustomerLedgerTransaction[],
  customerId: EntityId,
): LedgerRow[] {
  let runningBalancePkr = 0
  return selectCustomerLedgerTransactions(transactions, customerId).map(transaction => {
    const balanceImpactPkr = getCustomerLedgerTransactionBalanceImpactPkr(transaction)
    runningBalancePkr += balanceImpactPkr

    const teaType = transaction.type === 'purchase' ? transaction.teaType : null
    const quantityKg = transaction.type === 'purchase' ? transaction.quantityKg : null
    const ratePerKgPkr = transaction.type === 'purchase' ? transaction.ratePerKgPkr : null
    const paymentMethod: PaymentMethod | null = transaction.type === 'payment' ? transaction.paymentMethod : null

    return {
      transactionId: transaction.id,
      businessDate: transaction.businessDate,
      type: transaction.type,
      teaType,
      quantityKg,
      ratePerKgPkr,
      amountPkr: transaction.amountPkr,
      balanceImpactPkr,
      paymentMethod,
      runningBalancePkr,
      status: transaction.status,
      createdBy: transaction.createdBy,
      createdAt: transaction.createdAt,
    }
  })
}

export function selectCustomerSummary(
  customerId: EntityId,
  transactions: readonly CustomerLedgerTransaction[],
  referenceDate: BusinessDate,
): CustomerSummary {
  assertBusinessDate(referenceDate, 'Reference date')
  const activeTransactions = transactions.filter(transaction =>
    transaction.customerId === customerId && transaction.status === 'active')
  const activePurchases = activePurchaseTransactions(transactions, customerId)
  const activePayments = activeTransactions.filter(transaction => transaction.type === 'payment')
  const lastPurchaseDate = activePurchases
    .filter(transaction => transaction.businessDate <= referenceDate)
    .map(transaction => transaction.businessDate)
    .sort()
    .at(-1) ?? null
  const lastPaymentDate = getLastPaymentDate(transactions, customerId, referenceDate)

  return {
    customerId,
    totalPurchasedKg: activePurchases.reduce((total, transaction) => total + transaction.quantityKg, 0),
    totalPurchasedPkr: activePurchases.reduce((total, transaction) => total + transaction.amountPkr, 0),
    totalPaidPkr: activePayments.reduce((total, transaction) => total + transaction.amountPkr, 0),
    currentBalancePkr: getCustomerLedgerBalance(customerId, transactions),
    purchaseCount: activePurchases.length,
    lastPurchaseDate,
    productSummary: selectProductSummary(activePurchases),
    lastPaymentDate,
    daysSinceLastPayment: lastPaymentDate === null ? null : differenceInBusinessDays(lastPaymentDate, referenceDate),
  }
}

export function selectDailyPaymentBuckets(
  transactions: readonly CustomerLedgerTransaction[],
  dateRange: DateRange,
  customerId?: EntityId,
): DailyPaymentBucket[] {
  const buckets = new Map<BusinessDate, DailyPaymentBucket>(datesInRange(dateRange).map(date => [
    date,
    { date, amountPkr: 0, transactionCount: 0 },
  ]))

  for (const transaction of activePaymentTransactions(transactions, customerId)) {
    if (transaction.businessDate < dateRange.startDate || transaction.businessDate > dateRange.endDate) continue
    const bucket = buckets.get(transaction.businessDate)
    if (!bucket) continue
    bucket.amountPkr += transaction.amountPkr
    bucket.transactionCount += 1
  }

  return [...buckets.values()]
}

export function selectPaymentInsight(
  transactions: readonly CustomerLedgerTransaction[],
  dateRange: DateRange,
  referenceDate: BusinessDate,
  currentBalancePkr: number,
  customerId?: EntityId,
): PaymentInsight {
  assertBusinessDate(referenceDate, 'Reference date')
  const buckets = selectDailyPaymentBuckets(transactions, dateRange, customerId)
  const totalPaymentPkr = buckets.reduce((total, bucket) => total + bucket.amountPkr, 0)
  const paymentDays = buckets.filter(bucket => bucket.amountPkr > 0)
  const paymentTransactionCount = buckets.reduce((count, bucket) => count + bucket.transactionCount, 0)
  const highestPaymentDay = paymentDays.reduce<DailyPaymentBucket | null>((highest, bucket) => {
    if (!highest) return bucket
    if (bucket.amountPkr > highest.amountPkr) return bucket
    return highest
  }, null)

  const paymentDates = paymentDays.map(bucket => bucket.date)
  const lastPaymentDate = paymentDates.at(-1) ?? null
  const intervals = paymentDates.slice(1).map((date, index) => differenceInBusinessDays(paymentDates[index], date))
  const averageDailyPaymentPkr = paymentTransactionCount === 0 ? null : roundPkrAverage(totalPaymentPkr, buckets.length)
  const averagePaymentAmountPkr = paymentTransactionCount === 0 ? null : roundPkrAverage(totalPaymentPkr, paymentTransactionCount)

  return {
    highestPaymentDay,
    zeroPaymentDays: buckets.filter(bucket => bucket.amountPkr === 0).length,
    averageDailyPaymentPkr,
    averagePaymentAmountPkr,
    paymentDaysCount: paymentDays.length,
    paymentTransactionCount,
    lastPaymentDate,
    daysSinceLastPayment: lastPaymentDate === null ? null : differenceInBusinessDays(lastPaymentDate, referenceDate),
    averagePaymentIntervalDays: intervals.length === 0
      ? null
      : intervals.reduce((total, interval) => total + interval, 0) / intervals.length,
    estimatedDaysToClear: currentBalancePkr <= 0
      ? 0
      : averageDailyPaymentPkr === null || averageDailyPaymentPkr <= 0
        ? null
        : Math.ceil(currentBalancePkr / averageDailyPaymentPkr),
  }
}

export function selectPaymentCalendarBuckets(
  transactions: readonly CustomerLedgerTransaction[],
  dateRange: DateRange,
  customerId?: EntityId,
): PaymentCalendarBucket[] {
  const buckets = selectDailyPaymentBuckets(transactions, dateRange, customerId)
  const highestAmount = Math.max(0, ...buckets.map(bucket => bucket.amountPkr))

  return buckets.map(bucket => {
    if (highestAmount === 0) return { ...bucket, level: 'no_data' }
    if (bucket.amountPkr === 0) return { ...bucket, level: 'none' }
    if (bucket.amountPkr < highestAmount / 3) return { ...bucket, level: 'low' }
    if (bucket.amountPkr < (highestAmount * 2) / 3) return { ...bucket, level: 'medium' }
    return { ...bucket, level: 'high' }
  })
}

export function selectReminderCandidates(
  customers: readonly Customer[],
  transactions: readonly CustomerLedgerTransaction[],
  referenceDate: BusinessDate,
  thresholdDays: number,
): ReminderCandidate[] {
  assertBusinessDate(referenceDate, 'Reference date')
  if (!Number.isInteger(thresholdDays) || thresholdDays < 0) {
    throw new RangeError('Reminder threshold must be a non-negative integer number of days.')
  }

  return customers
    .filter(customer => customer.isActive)
    .map(customer => {
      const balanceDuePkr = getCustomerLedgerBalance(customer.id, transactions)
      const lastPaymentDate = getLastPaymentDate(transactions, customer.id, referenceDate)
      const daysSinceLastPayment = lastPaymentDate === null
        ? null
        : differenceInBusinessDays(lastPaymentDate, referenceDate)
      const earliestDebtDate = lastPaymentDate === null
        ? getEarliestActiveDebtDate(transactions, customer.id, referenceDate)
        : null
      const reminderAgeDays = daysSinceLastPayment
        ?? (earliestDebtDate === null ? null : differenceInBusinessDays(earliestDebtDate, referenceDate))

      return {
        candidate: {
          customerId: customer.id,
          customerName: customer.name,
          balanceDuePkr,
          lastPaymentDate,
          daysSinceLastPayment,
          thresholdDays,
        },
        reminderAgeDays,
      }
    })
    .filter(({ candidate, reminderAgeDays }) =>
      candidate.balanceDuePkr > 0
      && reminderAgeDays !== null
      && reminderAgeDays >= thresholdDays)
    .map(({ candidate }) => candidate)
    .sort((first, second) =>
      second.balanceDuePkr - first.balanceDuePkr
      || first.customerName.localeCompare(second.customerName)
      || first.customerId.localeCompare(second.customerId))
}
