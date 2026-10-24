import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: '/api/v1', authenticatedFetch: fixture.fetch }))
import { saveSupplier, supplierRequest, reconcileSupplier } from './supplier.api'
const supplier = { _id: 'supplier', name: 'Original', contactPerson: '', phone: '', alternatePhone: '', email: '', city: '', address: '', notes: '', status: 'active' as const, regions: [], products: [], productOfferings: [], revision: 3 }
beforeEach(() => vi.resetAllMocks())
describe('supplier authenticated API (offline)', () => {
  it('posts profile creation and parses the saved record', async () => {
    fixture.fetch.mockResolvedValue(new Response(JSON.stringify({ supplier })))
    expect((await saveSupplier(supplier))._id).toBe('supplier')
    expect(fixture.fetch).toHaveBeenCalledWith('/api/v1/purchases/suppliers', expect.objectContaining({ method: 'POST' }))
  })
  it('patches the stable supplier ID with its optimistic revision', async () => {
    fixture.fetch.mockResolvedValue(new Response(JSON.stringify({ supplier: { ...supplier, name: 'Renamed', revision: 4 } })))
    await saveSupplier({ ...supplier, name: 'Renamed' }, supplier)
    const [url, options] = fixture.fetch.mock.calls[0]
    expect(url).toBe('/api/v1/purchases/suppliers/supplier')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toMatchObject({ name: 'Renamed', revision: 3 })
  })
  it('surfaces validation and conflict responses without treating them as success', async () => {
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid', issues: [{ path: 'email', message: 'Invalid email' }] }), { status: 400 }))
    await expect(supplierRequest('', {})).rejects.toThrow('email: Invalid email')
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Supplier changed. Reopen.' }), { status: 409 }))
    await expect(saveSupplier(supplier, supplier)).rejects.toThrow('Supplier changed')
  })
  it('sends an independent supplier creation key, preserving manual offerings', async () => {
    fixture.fetch.mockResolvedValue(new Response(JSON.stringify({ supplier: { ...supplier, productOfferings: ['Premium Blend'] } })))
    await saveSupplier({ ...supplier, productOfferings: ['Premium Blend'] }, undefined, 'supplier-key-1')
    const body = JSON.parse(fixture.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ creationIdempotencyKey: 'supplier-key-1', productOfferings: ['Premium Blend'] })
    expect(body).not.toHaveProperty('idempotencyKey')
  })
  it('preserves duplicate codes and existing IDs separately from key conflicts', async () => {
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SUPPLIER_ALREADY_EXISTS', message: 'A supplier with this name already exists.', existingSupplierId: 'existing' }), { status: 409 }))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ code: 'SUPPLIER_ALREADY_EXISTS', existingSupplierId: 'existing', outcomeUncertain: false })
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'IDEMPOTENCY_CONFLICT', message: 'Request key conflict.' }), { status: 409 }))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', outcomeUncertain: false })
  })
  it('treats network loss and invalid success bodies as uncertain without retrying', async () => {
    fixture.fetch.mockRejectedValueOnce(new TypeError('Connection lost'))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ outcomeUncertain: true })
    expect(fixture.fetch).toHaveBeenCalledOnce()
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ outcomeUncertain: true })
    expect(fixture.fetch).toHaveBeenCalledTimes(2)
  })
  it('reconciles using GET only, with no write fallback', async () => {
    fixture.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'confirmed', supplier })))
    expect(await reconcileSupplier('supplier-key-1')).toMatchObject({ status: 'confirmed', supplier: { _id: 'supplier' } })
    expect(fixture.fetch).toHaveBeenCalledWith('/api/v1/purchases/suppliers/reconcile?creationIdempotencyKey=supplier-key-1', expect.objectContaining({ method: 'GET' }))
    expect(fixture.fetch.mock.calls[0][1]).not.toHaveProperty('body')
  })
  it('keeps a post-request authentication change uncertain while respecting definite HTTP rejections', async () => {
    fixture.fetch.mockRejectedValueOnce(Object.assign(new Error('Session changed.'), { status: 401 }))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED', outcomeUncertain: true })
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Sign in to continue.' }), { status: 401 }))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED', outcomeUncertain: false })
    fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }))
    await expect(saveSupplier(supplier)).rejects.toMatchObject({ code: 'FORBIDDEN', outcomeUncertain: false })
  })
})

