import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
const fixture = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, send: vi.fn(), saved: vi.fn(), failed: false, region: '507f1f77bcf86cd799439001', item: '507f1f77bcf86cd799439002', supplier: '507f1f77bcf86cd799439003' }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(), useEffect: vi.fn(),
  useState: (initial: any) => { const index = fixture.cursor++; if (!(index in fixture.states)) fixture.states[index] = typeof initial === 'function' ? initial() : initial; return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === 'function' ? next(fixture.states[index]) : next }] },
  useRef: (initial: unknown) => { const index = fixture.refCursor++; fixture.refs[index] ??= { current: initial }; return fixture.refs[index] },
}))
vi.mock('@tanstack/react-query', () => ({ useMutation: (options: any) => ({ isPending: false, isError: fixture.failed, error: new Error('Uncertain request'), mutate: vi.fn(), mutateAsync: async (input: unknown) => { try { const result = await options.mutationFn(input); await options.onSuccess?.(result); return result } catch (error) { fixture.failed = true; throw error } } }) }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { name: 'Admin' } } }) }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: fixture.region, name: 'Islamabad', status: 'active' }] }), useRegionalInventory: () => ({ data: [{ regionId: fixture.region, itemId: fixture.item, name: 'Green Tea', availableKg: 0, status: 'out_of_stock' }], isPending: false, isError: false }) }))
vi.mock('./purchase.api', () => ({ usePurchaseOptions: () => ({ data: [{ _id: fixture.supplier, name: 'Supplier' }] }), useInvalidatePurchases: () => vi.fn().mockResolvedValue(undefined), writePurchase: fixture.send, purchaseRequest: vi.fn() }))
import { RegionalPurchaseForm } from './components/RegionalPurchaseForm'
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render() { fixture.cursor = 0; fixture.refCursor = 0; return nodes(RegionalPurchaseForm({ onClose: vi.fn(), onSaved: fixture.saved })) }
const submit = async () => render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
beforeEach(() => {
  fixture.states = [{ supplier: fixture.supplier, item: fixture.item, receivingRegion: fixture.region, businessDate: '2026-10-15', quantity: '2', unitCost: '500', tax: '0', shipping: '0', discount: '0', amountPaid: '100', method: 'cash', status: 'received', reference: 'Invoice 1', notes: 'Delivery' }, '', null, '']
  fixture.refs = []; fixture.failed = false; fixture.send.mockReset(); fixture.saved.mockReset()
})
afterEach(() => vi.restoreAllMocks())
describe('regional purchase form event orchestration (offline)', () => {
  it('reviews a zero-stock assigned product before sending one atomic purchase and payment', async () => {
    await submit(); expect(fixture.send).not.toHaveBeenCalled()
    await submit()
    expect(fixture.send).toHaveBeenCalledWith('', expect.objectContaining({ receivingRegion: fixture.region, item: fixture.item, quantityKg: 2, unitCost: 500, payment: expect.objectContaining({ amountPkr: 100, method: 'cash' }), idempotencyKey: expect.any(String) }))
    expect(fixture.send.mock.calls[0][1]).not.toHaveProperty('createdBy')
    expect(fixture.saved).toHaveBeenCalledOnce()
  })
  it('retries exactly the reviewed payload and key after an uncertain network result', async () => {
    fixture.send.mockRejectedValueOnce(new TypeError('Network failed'))
    await submit(); await submit()
    const original = fixture.send.mock.calls[0][1]
    fixture.states[0] = { ...fixture.states[0], quantity: '999', receivingRegion: 'changed' }
    await submit()
    expect(fixture.send.mock.calls[1][1]).toBe(original)
  })
  it('rejects missing receiving regions or overpayment without sending a purchase', async () => {
    fixture.states[0].receivingRegion = ''
    await submit(); expect(fixture.send).not.toHaveBeenCalled()
    fixture.states[0].receivingRegion = fixture.region; fixture.states[0].amountPaid = '1001'
    await submit(); expect(fixture.send).not.toHaveBeenCalled()
  })
})
