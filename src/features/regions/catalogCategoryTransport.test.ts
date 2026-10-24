import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { acceptSession, clearSession, useAuthStore } from '../auth/auth.store'
import { loadCatalogCategories } from './catalogProduct.api'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  acceptSession({ user: { id: 'operator', name: 'Operator', email: 'operator@example.invalid', role: 'admin', shopId: 'shop', shopName: 'Offline Shop' }, csrfToken: 'offline-token', expiresAt: '2099-01-01T00:00:00.000Z' })
})
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('includes session cookies on the category GET without unnecessary preflight headers', async () => {
  fetchMock.mockResolvedValue(new Response('{"categories":["Other"]}'))
  await expect(loadCatalogCategories()).resolves.toEqual(['Other'])
  const init = fetchMock.mock.calls[0][1] as RequestInit
  expect(init.credentials).toBe('include')
  expect(init.method ?? 'GET').toBe('GET')
  const headers = new Headers(init.headers)
  expect(headers.get('Accept')).toBe('application/json')
  expect(headers.has('Content-Type')).toBe(false)
  expect(headers.has('X-CSRF-Token')).toBe(false)
  expect(headers.has('Authorization')).toBe(false)
})
it('keeps existing session expiry handling on a category 401', async () => {
  fetchMock.mockResolvedValue(new Response('not signed in', { status: 401 }))
  await expect(loadCatalogCategories()).rejects.toMatchObject({ status: 401 })
  expect(useAuthStore.getState().status).toBe('anonymous')
})
