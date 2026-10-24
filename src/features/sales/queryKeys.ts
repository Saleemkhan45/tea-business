import type { SalesQuery, TopProductsFilters } from './types/salesApi'

export const salesKeys = {
  all: ['sales'] as const,
  list: (filters: SalesQuery = {}) => [...salesKeys.all, 'list', filters] as const,
  topProducts: (filters: TopProductsFilters) => [...salesKeys.all, 'top-products', { ...filters, regionId: filters.regionId || '' }] as const,
}
