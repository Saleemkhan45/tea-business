import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { BusinessDate } from '../../business/domain/types'
import { isValidBusinessDate } from '../../business/utils/date'
import {
  CustomerLedgerApiError,
  createCustomerAdjustment,
  createCustomerOpeningBalance,
  createCustomerPayment,
  createCustomerPurchase,
  createCustomer,
  getCustomerById,
  getCustomerDirectory,
  getCustomerLedger,
  getCustomerLedgerDailyPayments,
  getCustomerLedgerPaymentCalendar,
  getCustomerLedgerPaymentInsights,
  getCustomerLedgerReminderCandidate,
  getCustomerLedgerSummary,
  isValidCustomerId,
  voidCustomerLedgerTransaction,
} from './customerLedgerApi'
import { scopedKey, useScopedQueryKey } from '../auth/queryScope'
import { useAuthStore } from '../auth/auth.store'
import { customerLedgerKeys } from './queryKeys'
import { salesKeys } from '../sales/queryKeys'
import type {
  CreateAdjustmentInput,
  CreateOpeningBalanceInput,
  CreatePaymentInput,
  CreatePurchaseInput,
  CustomerDirectoryFilters,
  LedgerFilters,
  PaymentDateRange,
  PaymentInsightsParams,
  VoidTransactionInput,
} from './types'

function requireCustomerId(customerId: string | undefined): string {
  if (!customerId) throw new TypeError('Customer ID is required.')
  if (!isValidCustomerId(customerId)) throw new TypeError('Customer ID is invalid.')
  return customerId
}

function retryCustomerQuery(failureCount: number, error: Error) {
  return failureCount < 1 && !(error instanceof CustomerLedgerApiError && error.status >= 400 && error.status < 500)
}

function validDateRange(from?: BusinessDate, to?: BusinessDate) {
  return (!from || isValidBusinessDate(from)) && (!to || isValidBusinessDate(to)) && (!from || !to || from <= to)
}

async function invalidateCustomerLedger(queryClient: QueryClient, customerId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['collections'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: customerLedgerKeys.customer(customerId) }),
    queryClient.invalidateQueries({ queryKey: customerLedgerKeys.directory().slice(0, -1) }),
    queryClient.invalidateQueries({ queryKey: salesKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['regional'] }),
  ])
}

function normalizeDirectoryFilters(filters: CustomerDirectoryFilters = {}): Required<CustomerDirectoryFilters> {
  return {
    search: filters.search?.trim() ?? '',
    status: filters.status ?? '',
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  }
}

export function useCustomerDirectory(filters: CustomerDirectoryFilters = {}, enabled = true) {
  const normalizedFilters = normalizeDirectoryFilters(filters)
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.directory(normalizedFilters)),
    enabled,
    queryFn: () => getCustomerDirectory(normalizedFilters),
    staleTime: 30_000,
    retry: retryCustomerQuery,
  })
}

export function useCreateCustomer() {
  const user = useAuthStore(state => state.session?.user)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    retry: false,
    onSuccess: ({ customer }) => {
      queryClient.setQueryData(scopedKey(customerLedgerKeys.profile(customer.id), user), { customer })
      return Promise.all([queryClient.invalidateQueries({ queryKey: customerLedgerKeys.directory().slice(0, -1) }), queryClient.invalidateQueries({ queryKey: ['regional'] })])
    },
  })
}

export function useCustomerById(customerId: string | undefined) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.profile(customerId ?? '')),
    queryFn: () => getCustomerById(requireCustomerId(customerId)),
    enabled: isValidCustomerId(customerId),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedger(customerId: string | undefined, filters: LedgerFilters = {}) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.ledger(customerId ?? '', filters)),
    queryFn: () => getCustomerLedger(requireCustomerId(customerId), filters),
    enabled: isValidCustomerId(customerId) && validDateRange(filters.from, filters.to),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedgerSummary(customerId: string | undefined, referenceDate?: BusinessDate) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.summary(customerId ?? '', referenceDate)),
    queryFn: () => getCustomerLedgerSummary(requireCustomerId(customerId), referenceDate),
    enabled: isValidCustomerId(customerId),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedgerDailyPayments(customerId: string | undefined, range: PaymentDateRange) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.dailyPayments(customerId ?? '', range)),
    queryFn: () => getCustomerLedgerDailyPayments(requireCustomerId(customerId), range),
    enabled: isValidCustomerId(customerId) && validDateRange(range.from, range.to),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedgerPaymentInsights(customerId: string | undefined, params: PaymentInsightsParams) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.paymentInsights(customerId ?? '', params)),
    queryFn: () => getCustomerLedgerPaymentInsights(requireCustomerId(customerId), params),
    enabled: isValidCustomerId(customerId) && validDateRange(params.from, params.to),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedgerPaymentCalendar(customerId: string | undefined, range: PaymentDateRange) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.paymentCalendar(customerId ?? '', range)),
    queryFn: () => getCustomerLedgerPaymentCalendar(requireCustomerId(customerId), range),
    enabled: isValidCustomerId(customerId) && validDateRange(range.from, range.to),
    retry: retryCustomerQuery,
  })
}

export function useCustomerLedgerReminderCandidate(
  customerId: string | undefined,
  thresholdDays: number,
  referenceDate?: BusinessDate,
) {
  return useQuery({
    queryKey: useScopedQueryKey(customerLedgerKeys.reminderCandidate(customerId ?? '', thresholdDays, referenceDate)),
    queryFn: () => getCustomerLedgerReminderCandidate(requireCustomerId(customerId), thresholdDays, referenceDate),
    enabled: isValidCustomerId(customerId),
    retry: retryCustomerQuery,
  })
}

export function useCreateCustomerPurchase(customerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePurchaseInput) => createCustomerPurchase(requireCustomerId(customerId), input),
    onSuccess: () => invalidateCustomerLedger(queryClient, requireCustomerId(customerId)),
  })
}

export function useCreateCustomerPayment(customerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createCustomerPayment(requireCustomerId(customerId), input),
    onSuccess: () => invalidateCustomerLedger(queryClient, requireCustomerId(customerId)),
  })
}

export function useCreateCustomerOpeningBalance(customerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpeningBalanceInput) => createCustomerOpeningBalance(requireCustomerId(customerId), input),
    onSuccess: () => invalidateCustomerLedger(queryClient, requireCustomerId(customerId)),
  })
}

export function useCreateCustomerAdjustment(customerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAdjustmentInput) => createCustomerAdjustment(requireCustomerId(customerId), input),
    onSuccess: () => invalidateCustomerLedger(queryClient, requireCustomerId(customerId)),
  })
}

export function useVoidCustomerLedgerTransaction(customerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ transactionId, reason }: VoidTransactionInput) =>
      voidCustomerLedgerTransaction(requireCustomerId(customerId), transactionId, reason),
    onSuccess: () => invalidateCustomerLedger(queryClient, requireCustomerId(customerId)),
  })
}



