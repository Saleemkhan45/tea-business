import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
const { send, fetchCategories } = vi.hoisted(() => ({ send: vi.fn(), fetchCategories: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: 'http://localhost:4000/api/v1', authenticatedFetch: fetchCategories }))
vi.mock('./regionalInventory.api', async original => ({ ...await original<typeof import('./regionalInventory.api')>(), regionalRequest: send }))
import { CatalogCategoryError, catalogCategoryQueryOptions, categoryErrorMessage, loadCatalogCategories, saveCatalogProduct } from './catalogProduct.api'
beforeEach(() => { send.mockReset(); fetchCategories.mockReset() })
it('requires a confirmed product response before considering a catalog save successful', async () => {
  send.mockResolvedValueOnce({ product: { _id: 'p1', name: 'Tea', teaType: 'Other', status: 'active', sellingPrice: 950 } })
  await expect(saveCatalogProduct({ name: 'Tea' })).resolves.toMatchObject({ _id: 'p1', sellingPrice: 950 })
  send.mockResolvedValueOnce({ message: 'ok' })
  await expect(saveCatalogProduct({ name: 'Tea' })).rejects.toThrow()
})

describe('category metadata requests (mocked HTTP, no server or database)', () => {
  it('maps supported category strings including Other from the exact endpoint', async () => {
    fetchCategories.mockResolvedValue(new Response(JSON.stringify({ categories: ['Green Tea', 'Other'] })))
    await expect(loadCatalogCategories()).resolves.toEqual(['Green Tea', 'Other'])
    expect(fetchCategories).toHaveBeenCalledWith('http://localhost:4000/api/v1/regional/product-options', expect.objectContaining({ headers: { Accept: 'application/json' } }))
  })
  it('accepts an empty list without fabricating fallback categories', async () => {
    fetchCategories.mockResolvedValue(new Response('{"categories":[]}'))
    await expect(loadCatalogCategories()).resolves.toEqual([])
  })
  it('does not duplicate category options returned more than once', async () => {
    fetchCategories.mockResolvedValue(new Response('{"categories":["Other","Other"]}'))
    await expect(loadCatalogCategories()).resolves.toEqual(['Other'])
  })
  it.each([
    [401, 'Sign in again'], [403, 'access was denied'], [404, 'Update or restart'], [500, 'unavailable'],
  ])('preserves HTTP %s and reports a safe actionable error even for non-JSON bodies', async (status, message) => {
    fetchCategories.mockResolvedValue(new Response('private server details', { status: Number(status) }))
    let failure: unknown
    try { await loadCatalogCategories() } catch (error) { failure = error }
    expect(failure).toMatchObject({ status, message: expect.stringContaining(String(message)) })
    expect(categoryErrorMessage(failure)).not.toContain('private server details')
  })
  it('handles a locally expired session before any HTTP response', async () => {
    fetchCategories.mockRejectedValue(Object.assign(new Error('private'), { status: 401 }))
    await expect(loadCatalogCategories()).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Sign in again') })
  })
  it('reports network/CORS failures safely', async () => {
    fetchCategories.mockRejectedValue(new TypeError('private network address'))
    await expect(loadCatalogCategories()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('API address') })
    expect(categoryErrorMessage(new Error('private raw error'))).not.toContain('private')
  })
  it.each(['not JSON', '{"data":{"categories":["Other"]}}', '{"categories":[{"name":"Other"}]}', '{"categories":[""]}', '{"products":[]}'])('rejects incorrect category response mapping: %s', async body => {
    fetchCategories.mockResolvedValue(new Response(body))
    await expect(loadCatalogCategories()).rejects.toMatchObject({ status: 200, message: expect.stringContaining('invalid category data') })
  })
  it('passes cancellation through without converting it into a network error', async () => {
    const controller = new AbortController(), abort = new DOMException('Cancelled', 'AbortError')
    controller.abort(); fetchCategories.mockRejectedValue(abort)
    await expect(loadCatalogCategories(controller.signal)).rejects.toBe(abort)
  })
  it('requests on subscription, retries only explicitly, and deduplicates overlapping retries', async () => {
    const client = new QueryClient(), observer = new QueryObserver(client, catalogCategoryQueryOptions())
    fetchCategories.mockResolvedValueOnce(new Response('missing route', { status: 404 }))
    const unsubscribe = observer.subscribe(() => {})
    try {
      const first = await observer.refetch({ cancelRefetch: false })
      expect(first.error).toBeInstanceOf(CatalogCategoryError)
      expect(fetchCategories).toHaveBeenCalledTimes(1)
      fetchCategories.mockResolvedValueOnce(new Response('{"categories":["Green Tea","Other"]}'))
      const [retry, repeatedClick] = await Promise.all([observer.refetch({ cancelRefetch: false }), observer.refetch({ cancelRefetch: false })])
      expect(retry.data).toEqual(['Green Tea', 'Other']); expect(repeatedClick.data).toEqual(retry.data)
      expect(fetchCategories).toHaveBeenCalledTimes(2)
      await client.fetchQuery(catalogCategoryQueryOptions())
      expect(fetchCategories).toHaveBeenCalledTimes(2)
      expect(catalogCategoryQueryOptions()).toMatchObject({ retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
    } finally { unsubscribe(); client.clear() }
  })
})
