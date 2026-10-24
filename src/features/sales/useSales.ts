import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { customerLedgerKeys } from '../customer-ledger/queryKeys'
import { notificationKeys } from '../notifications/queryKeys'
import { salesKeys } from './queryKeys'
import { useAuthStore } from '../auth/auth.store'
import { scopedKey, useScopedQueryKey } from '../auth/queryScope'
import { createSale, getSaleEntryOptions, getSalesSummary, getSales, getTopSellingProducts, updateSale, voidSale } from './services/sales.service'
import type { CreateSaleInput, SaleDto, SalesQuery, TopProductsFilters, UpdateSaleInput } from './types/salesApi'

async function invalidateSaleQueries(queryClient: QueryClient, sale: SaleDto, previousCustomerId?: string) {
  const keys: ReadonlyArray<readonly unknown[]> = [
    salesKeys.all,
    ['regional'],
    customerLedgerKeys.directory().slice(0, -1),
    notificationKeys.lists(),
    notificationKeys.unreadCount(),
    ...[...new Set([sale.customer, previousCustomerId].filter(id => id !== undefined))]
      .map(id => customerLedgerKeys.customer(id)),
  ]
  await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })))
}

export function useSales(filters: SalesQuery = {}, enabled = true) {
  return useQuery({ queryKey: useScopedQueryKey(salesKeys.list(filters)), queryFn: () => getSales(filters), enabled })
}

export function useSaleEntryOptions(regionId?: string, enabled = true) {
  return useQuery({ queryKey: useScopedQueryKey([...salesKeys.all, 'entry-options', regionId ?? 'legacy']), queryFn: () => getSaleEntryOptions(regionId), enabled, refetchOnMount: 'always' })
}

export function useSalesSummary(date: string) {
  return useQuery({ queryKey: useScopedQueryKey([...salesKeys.all, 'summary', date]), queryFn: () => getSalesSummary(date) })
}

export function useTopSellingProducts(filters: TopProductsFilters) {
  const user = useAuthStore(state => state.session?.user)
  return useQuery({
    queryKey: scopedKey(salesKeys.topProducts(filters), user),
    queryFn: ({ signal }) => getTopSellingProducts(filters, signal),
    refetchOnWindowFocus: true,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSaleInput) => createSale(input),
    retry: false,
    onSuccess: ({ sale }) => invalidateSaleQueries(queryClient, sale),
  })
}

export function useUpdateSale(saleId: string, previousCustomerId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSaleInput) => updateSale(saleId, input),
    retry: false,
    onSuccess: ({ sale }) => invalidateSaleQueries(queryClient, sale, previousCustomerId),
  })
}

export function useVoidSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) => voidSale(saleId, reason),
    retry: false,
    onSuccess: ({ sale }) => invalidateSaleQueries(queryClient, sale),
  })
}
