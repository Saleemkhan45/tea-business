import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ authenticatedFetch: vi.fn(), API_BASE_URL: 'http://localhost/api/v1' }))
vi.mock('../auth/auth.api', () => auth)
import { purchaseRequest, writePurchase } from './purchase.api'

const purchase = { _id: 'purchase', supplier: 'supplier', item: 'item', receivingRegion: 'region', businessDate: '2026-10-15', quantityKg: 2, totalAmount: 1000, paidAmount: 0, status: 'received' }
beforeEach(() => vi.clearAllMocks())
describe('protected purchase transport (offline)', () => {
  it('uses the authenticated transport and parses persisted purchase responses', async () => {
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ purchase }), { status: 201 }))
    const input = { idempotencyKey: 'frozen-operation', receivingRegion: 'region' }
    expect(await writePurchase('', input)).toEqual(purchase)
    expect(auth.authenticatedFetch).toHaveBeenCalledWith('http://localhost/api/v1/purchases', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }))
  })
  it('surfaces authorization and transaction conflicts without a hidden retry', async () => {
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Insufficient regional stock.' }), { status: 409 }))
    await expect(writePurchase('/id/void', { reason: 'Return' })).rejects.toMatchObject({ status: 409, message: 'Insufficient regional stock.' })
    expect(auth.authenticatedFetch).toHaveBeenCalledOnce()
  })
  it('keeps transport uncertainty distinct from definitive input errors', async () => {
    auth.authenticatedFetch.mockRejectedValueOnce(new TypeError('Network failed'))
    await expect(purchaseRequest('', {})).rejects.toMatchObject({ status: 0 })
    auth.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid', issues: [{ message: 'Choose a receiving region.' }] }), { status: 400 }))
    await expect(purchaseRequest('', {})).rejects.toMatchObject({ status: 400, message: 'Choose a receiving region.' })
  })
})
