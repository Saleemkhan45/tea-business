import type {
  CreateAdjustmentRequest,
  CreateAdjustmentResponse,
  CreateCustomerPaymentRequest,
  CreateCustomerPaymentResponse,
  CreateCustomerPurchaseRequest,
  CreateCustomerPurchaseResponse,
  CreateOpeningBalanceRequest,
  CreateOpeningBalanceResponse,
  CustomerLedgerResponse,
  DailyPaymentsResponse,
  PaymentCalendarResponse,
} from '../../business/domain/customer-ledger.contracts'
import type {
  CustomerLedgerTransaction,
  CustomerSummary,
  PaymentInsight,
  ReminderCandidate,
} from '../../business/domain/customer-ledger.types'
import type { BusinessDate } from '../../business/domain/types'

export type LedgerFilters = {
  from?: BusinessDate
  to?: BusinessDate
  type?: CustomerLedgerTransaction['type']
  status?: CustomerLedgerTransaction['status']
  teaType?: import('../../business/domain/customer-ledger.types').LedgerTeaType
}

export type CustomerDirectoryStatus = 'active' | 'inactive'
export type CustomerDirectoryFilters = {
  search?: string
  status?: CustomerDirectoryStatus | ''
  page?: number
  limit?: number
}

export type CustomerDirectoryItem = {
  id: string
  name: string
  phone: string
  address: string
  status: CustomerDirectoryStatus
  currentBalancePkr: number
  region?: string
  city?: string
  notes?: string
  createdAt?: string
}

export type CustomerProfile = Pick<CustomerDirectoryItem, 'id' | 'name' | 'phone' | 'address' | 'status' | 'region' | 'city' | 'notes' | 'createdAt'>
export type CustomerByIdResponse = { customer: CustomerProfile }

export type CreateCustomerInput = {
  name: string
  phone?: string
  address?: string
  region?: string
  city?: string
  notes?: string
  openingBalancePkr?: number
  idempotencyKey?: string
}

export type CustomerDirectoryResponse = {
  customers: CustomerDirectoryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type PaymentDateRange = { from: BusinessDate; to: BusinessDate }
export type PaymentInsightsParams = PaymentDateRange & { referenceDate?: BusinessDate }

export type CreatePurchaseInput = Omit<CreateCustomerPurchaseRequest, 'customerId'>
export type CreatePaymentInput = Omit<CreateCustomerPaymentRequest, 'customerId'> & { idempotencyKey?: string; collectionOccurrence?: string }
export type CreateOpeningBalanceInput = Omit<CreateOpeningBalanceRequest, 'customerId'>
export type CreateAdjustmentInput = Omit<CreateAdjustmentRequest, 'customerId'>
export type VoidTransactionInput = { transactionId: string; reason: string }

export type LedgerApiResponse = CustomerLedgerResponse & { currentBalancePkr: number }
export type SummaryApiResponse = { summary: CustomerSummary }
export type DailyPaymentsApiResponse = DailyPaymentsResponse
export type PaymentInsightsApiResponse = { customerId: string; startDate: BusinessDate; endDate: BusinessDate; insight: PaymentInsight }
export type PaymentCalendarApiResponse = PaymentCalendarResponse
export type ReminderCandidateApiResponse = { candidate: ReminderCandidate | null }

export type PurchaseApiResponse = CreateCustomerPurchaseResponse
export type PaymentApiResponse = CreateCustomerPaymentResponse
export type OpeningBalanceApiResponse = CreateOpeningBalanceResponse
export type AdjustmentApiResponse = CreateAdjustmentResponse
export type VoidApiResponse = { transaction: CustomerLedgerTransaction }
