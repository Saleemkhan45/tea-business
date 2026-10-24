import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
import { productSchema, regionalRequest, useRegions } from './regionalInventory.api'

const categoryOptionsSchema = z.object({ categories: z.array(z.string().trim().min(1)) })

export class CatalogCategoryError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CatalogCategoryError'
    this.status = status
  }
}

function categoryHttpError(status: number) {
  const message = status === 401 ? 'Your session has expired. Sign in again to load categories.'
    : status === 403 ? 'Category access was denied (403). Ask your administrator to check access and the allowed dashboard origin.'
      : status === 404 ? 'The category endpoint was not found (404). Update or restart the backend with the current code, then retry.'
        : status >= 500 ? `The category service is unavailable (${status}). Check the backend, then retry.`
          : `The category request was rejected (${status}). Check the API configuration, then retry.`
  return new CatalogCategoryError(message, status)
}

export function categoryErrorMessage(error: unknown) {
  return error instanceof CatalogCategoryError ? error.message : 'Unable to load categories. Check the backend connection and retry.'
}

export async function loadCatalogCategories(signal?: AbortSignal) {
  let response: Response
  try {
    // A read needs no JSON Content-Type or CSRF header. Keep session cookies
    // through the shared authentication helper without triggering a preflight.
    response = await authenticatedFetch(`${API_BASE_URL}/regional/product-options`, { headers: { Accept: 'application/json' }, signal })
  } catch (failure) {
    if (signal?.aborted) throw failure
    if ((failure as { status?: number })?.status === 401) throw categoryHttpError(401)
    throw new CatalogCategoryError('Unable to reach the category service. Check the API address, backend, network and allowed dashboard origin, then retry.', 0)
  }
  // Inspect status before parsing: missing routes can return HTML rather than JSON.
  if (!response.ok) throw categoryHttpError(response.status)
  const result = categoryOptionsSchema.safeParse(await response.json().catch(() => null))
  if (!result.success) throw new CatalogCategoryError('The backend returned invalid category data. Check the API address and frontend/backend versions, then retry.', response.status)
  return [...new Set(result.data.categories)]
}

export function catalogCategoryQueryOptions() {
  return {
    queryKey: ['regional', 'product-options'] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => loadCatalogCategories(signal),
    retry: false as const,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }
}

export function useCatalogProductOptions(pendingRegion: boolean) {
  const categories = useQuery(catalogCategoryQueryOptions())
  const regions = useRegions(!pendingRegion)
  return { categories, regions }
}
export async function saveCatalogProduct(body: object) {
  return z.object({ product: productSchema }).parse(await regionalRequest('/products', body)).product
}
