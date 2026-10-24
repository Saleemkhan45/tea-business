import type { BusinessDate } from '../../business/domain/types'
import type { CustomerDirectoryFilters, LedgerFilters, PaymentDateRange, PaymentInsightsParams } from './types'

export const customerLedgerKeys = {
  all: ['customerLedger'] as const,
  directory: (filters: CustomerDirectoryFilters = {}) => [
    ...customerLedgerKeys.all,
    'customer-directory',
    {
      search: filters.search?.trim() ?? '',
      status: filters.status ?? '',
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    },
  ] as const,
  customer: (customerId: string) => [...customerLedgerKeys.all, customerId] as const,
  profile: (customerId: string) => [...customerLedgerKeys.all, 'customer-profile', customerId] as const,
  ledger: (customerId: string, filters: LedgerFilters = {}) => [
    ...customerLedgerKeys.customer(customerId), 'ledger',
    { from: filters.from ?? null, to: filters.to ?? null, type: filters.type ?? null, status: filters.status ?? null, teaType: filters.teaType ?? null },
  ] as const,
  summary: (customerId: string, referenceDate?: BusinessDate) => [
    ...customerLedgerKeys.customer(customerId), 'summary', referenceDate ?? null,
  ] as const,
  dailyPayments: (customerId: string, range: PaymentDateRange) => [
    ...customerLedgerKeys.customer(customerId), 'daily-payments', range.from, range.to,
  ] as const,
  paymentInsights: (customerId: string, params: PaymentInsightsParams) => [
    ...customerLedgerKeys.customer(customerId), 'payment-insights', params.from, params.to, params.referenceDate ?? null,
  ] as const,
  paymentCalendar: (customerId: string, range: PaymentDateRange) => [
    ...customerLedgerKeys.customer(customerId), 'payment-calendar', range.from, range.to,
  ] as const,
  reminderCandidate: (customerId: string, thresholdDays: number, referenceDate?: BusinessDate) => [
    ...customerLedgerKeys.customer(customerId), 'reminder-candidate', thresholdDays, referenceDate ?? null,
  ] as const,
}
