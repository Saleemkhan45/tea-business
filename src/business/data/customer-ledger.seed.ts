import type { BusinessDate, IsoTimestamp } from '../domain/types'
import type { Customer, CustomerLedgerSeedData, CustomerLedgerTransaction } from '../domain/customer-ledger.types'
import {
  calculateCustomerPurchaseAmountPkr,
  compareCustomerLedgerTransactions,
} from '../domain/customer-ledger.types'
import { getPakistanBusinessDate, shiftBusinessDate, startOfDay } from '../utils/date'
import { seedIds } from './seed'

const CUSTOMER_IDS = {
  ahmed: 'customer-ahmed-khan',
  fatima: 'customer-fatima-traders',
} as const

function timestampFor(businessDate: BusinessDate, hour: number, minute = 0): IsoTimestamp {
  return new Date(startOfDay(businessDate).getTime() + ((hour * 60 + minute) * 60_000)).toISOString()
}

export function createCustomerLedgerSeed(referenceDate = getPakistanBusinessDate()): CustomerLedgerSeedData {
  const customerCreatedDate = shiftBusinessDate(referenceDate, -30)
  const customerCreatedAt = timestampFor(customerCreatedDate, 9)
  const seedUpdatedAt = timestampFor(referenceDate, 17)
  const customers: Customer[] = [
    {
      id: CUSTOMER_IDS.ahmed,
      businessId: seedIds.business,
      name: 'Ahmed Khan',
      phone: '+92 300 1234567',
      address: 'Mingora, Swat',
      isActive: true,
      createdAt: customerCreatedAt,
      updatedAt: seedUpdatedAt,
    },
    {
      id: CUSTOMER_IDS.fatima,
      businessId: seedIds.business,
      name: 'Fatima Traders',
      phone: '+92 321 7654321',
      address: 'University Road, Peshawar',
      isActive: true,
      createdAt: customerCreatedAt,
      updatedAt: seedUpdatedAt,
    },
  ]

  const ahmedFirstPurchaseDate = shiftBusinessDate(referenceDate, -8)
  const ahmedFirstPaymentDate = shiftBusinessDate(referenceDate, -7)
  const ahmedSecondPaymentDate = shiftBusinessDate(referenceDate, -6)
  const ahmedSecondPurchaseDate = shiftBusinessDate(referenceDate, -1)
  const fatimaOpeningDate = shiftBusinessDate(referenceDate, -12)
  const fatimaPurchaseDate = shiftBusinessDate(referenceDate, -10)
  const fatimaFirstPaymentDate = shiftBusinessDate(referenceDate, -9)
  const fatimaAdjustmentDate = shiftBusinessDate(referenceDate, -4)
  const fatimaSecondPaymentDate = shiftBusinessDate(referenceDate, -2)
  const fatimaVoidedPaymentDate = shiftBusinessDate(referenceDate, -1)

  const transactions: CustomerLedgerTransaction[] = [
    {
      id: 'ledger-ahmed-purchase-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.ahmed,
      type: 'purchase',
      saleId: 'sale-ahmed-credit-001',
      teaType: 'green',
      stockLocationId: seedIds.locations.swat,
      quantityKg: 100,
      ratePerKgPkr: 1000,
      amountPkr: calculateCustomerPurchaseAmountPkr(100, 1000),
      businessDate: ahmedFirstPurchaseDate,
      createdAt: timestampFor(ahmedFirstPurchaseDate, 10),
      updatedAt: timestampFor(ahmedFirstPurchaseDate, 10),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: 'Initial wholesale Green Tea purchase on credit.',
    },
    {
      id: 'ledger-ahmed-payment-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.ahmed,
      type: 'payment',
      amountPkr: 5000,
      paymentMethod: 'cash',
      businessDate: ahmedFirstPaymentDate,
      createdAt: timestampFor(ahmedFirstPaymentDate, 11),
      updatedAt: timestampFor(ahmedFirstPaymentDate, 11),
      createdBy: seedIds.users.operator,
      status: 'active',
      notes: 'Cash collection.',
    },
    {
      id: 'ledger-ahmed-payment-002',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.ahmed,
      type: 'payment',
      amountPkr: 10000,
      paymentMethod: 'bank_transfer',
      businessDate: ahmedSecondPaymentDate,
      createdAt: timestampFor(ahmedSecondPaymentDate, 14),
      updatedAt: timestampFor(ahmedSecondPaymentDate, 14),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: 'Bank transfer received.',
    },
    {
      id: 'ledger-ahmed-purchase-002',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.ahmed,
      type: 'purchase',
      saleId: 'sale-ahmed-credit-002',
      teaType: 'green',
      stockLocationId: seedIds.locations.swat,
      quantityKg: 50,
      ratePerKgPkr: 1000,
      amountPkr: calculateCustomerPurchaseAmountPkr(50, 1000),
      businessDate: ahmedSecondPurchaseDate,
      createdAt: timestampFor(ahmedSecondPurchaseDate, 9, 30),
      updatedAt: timestampFor(ahmedSecondPurchaseDate, 9, 30),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: 'Repeat Green Tea purchase on credit.',
    },
    {
      id: 'ledger-ahmed-payment-003',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.ahmed,
      type: 'payment',
      amountPkr: 15000,
      paymentMethod: 'cheque',
      businessDate: referenceDate,
      createdAt: timestampFor(referenceDate, 12),
      updatedAt: timestampFor(referenceDate, 12),
      createdBy: seedIds.users.operator,
      status: 'active',
      notes: 'Cheque received against outstanding balance.',
    },
    {
      id: 'ledger-fatima-opening-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'opening_balance',
      amountPkr: 25000,
      businessDate: fatimaOpeningDate,
      createdAt: timestampFor(fatimaOpeningDate, 9),
      updatedAt: timestampFor(fatimaOpeningDate, 9),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: 'Verified balance brought forward.',
    },
    {
      id: 'ledger-fatima-purchase-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'purchase',
      saleId: 'sale-fatima-credit-001',
      teaType: 'black',
      stockLocationId: seedIds.locations.peshawar,
      quantityKg: 30,
      ratePerKgPkr: 1200,
      amountPkr: calculateCustomerPurchaseAmountPkr(30, 1200),
      businessDate: fatimaPurchaseDate,
      createdAt: timestampFor(fatimaPurchaseDate, 10),
      updatedAt: timestampFor(fatimaPurchaseDate, 10),
      createdBy: seedIds.users.operator,
      status: 'active',
      notes: null,
    },
    {
      id: 'ledger-fatima-payment-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'payment',
      amountPkr: 10000,
      paymentMethod: 'bank_transfer',
      businessDate: fatimaFirstPaymentDate,
      createdAt: timestampFor(fatimaFirstPaymentDate, 15),
      updatedAt: timestampFor(fatimaFirstPaymentDate, 15),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: null,
    },
    {
      id: 'ledger-fatima-adjustment-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'adjustment',
      amountPkr: -1000,
      reason: 'Approved correction for a prior pricing discrepancy.',
      businessDate: fatimaAdjustmentDate,
      createdAt: timestampFor(fatimaAdjustmentDate, 10),
      updatedAt: timestampFor(fatimaAdjustmentDate, 10),
      createdBy: seedIds.users.admin,
      status: 'active',
      notes: 'Owner-approved account correction.',
    },
    {
      id: 'ledger-fatima-payment-002',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'payment',
      amountPkr: 5000,
      paymentMethod: 'other',
      businessDate: fatimaSecondPaymentDate,
      createdAt: timestampFor(fatimaSecondPaymentDate, 16),
      updatedAt: timestampFor(fatimaSecondPaymentDate, 16),
      createdBy: seedIds.users.operator,
      status: 'active',
      notes: 'Payment received through an external collection agent.',
    },
    {
      id: 'ledger-fatima-payment-voided-001',
      businessId: seedIds.business,
      customerId: CUSTOMER_IDS.fatima,
      type: 'payment',
      amountPkr: 2000,
      paymentMethod: 'cash',
      businessDate: fatimaVoidedPaymentDate,
      createdAt: timestampFor(fatimaVoidedPaymentDate, 11),
      updatedAt: timestampFor(referenceDate, 9),
      createdBy: seedIds.users.operator,
      status: 'voided',
      notes: 'Incorrect duplicate cash entry.',
      voidedAt: timestampFor(referenceDate, 9),
      voidedBy: seedIds.users.admin,
      voidReason: 'Duplicate payment entry.',
    },
  ]

  return {
    customers,
    transactions: [...transactions].sort(compareCustomerLedgerTransactions),
  }
}

export const customerLedgerSeedIds = {
  customers: CUSTOMER_IDS,
} as const
