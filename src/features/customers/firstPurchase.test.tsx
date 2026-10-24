import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

const fixture = vi.hoisted(() => ({
  states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0,
  submit: vi.fn(), createCustomer: vi.fn(), saved: vi.fn(), fromSale: false, status: 'idle',
  region: '507f1f77bcf86cd799439020', stock: '507f1f77bcf86cd799439021',
}))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: vi.fn(),
  useState: (initial: unknown) => {
    const index = fixture.cursor++
    if (!(index in fixture.states)) fixture.states[index] = typeof initial === 'function' ? initial() : initial
    return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === 'function' ? next(fixture.states[index]) : next }]
  },
  useRef: (initial: unknown) => {
    const index = fixture.refCursor++
    fixture.refs[index] ??= { current: initial }
    return fixture.refs[index]
  },
}))
vi.mock('../customer-ledger', () => ({
  CustomerLedgerApiError: class extends Error {},
  getCustomerLedgerErrorMessage: () => 'Request failed',
  useCreateCustomer: () => ({ isPending: false, mutateAsync: fixture.createCustomer }),
}))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { name: 'Admin' } } }) }))
vi.mock('../sales/useSaleSubmission', () => ({ useSaleSubmission: () => ({ status: fixture.status, hasActiveRequest: fixture.status === 'error', error: null, submit: fixture.submit, reset: vi.fn() }) }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: fixture.region, name: 'Islamabad', status: 'active' }], isPending: false, isError: false }) }))
vi.mock('../sales/useSales', () => ({ useSaleEntryOptions: () => ({ isPending: false, isError: false, data: { operator: { name: 'Admin' }, items: [{ id: fixture.stock, regionId: fixture.region, availableKg: 50, teaType: 'green', name: 'Green Tea', sellingPrice: 800 }] } }) }))
import { AddCustomerModal } from './components/AddCustomerModal'
import { SellingRegionSelector } from '../sales/components/RegionalSaleSelectors'

function nodes(node: ReactNode): ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : []
}
function render() {
  fixture.cursor = 0; fixture.refCursor = 0
  return nodes(AddCustomerModal({ onClose: vi.fn(), onSaved: fixture.saved, fromSale: fixture.fromSale }))
}
beforeEach(() => {
  fixture.fromSale = false; fixture.saved.mockReset(); fixture.status = 'idle'; fixture.refs = []; fixture.submit.mockReset(); fixture.createCustomer.mockReset()
  fixture.states = [
    { name: 'Retailer', phone: '', city: 'Customer city', region: 'Customer region', address: '', notes: 'Customer notes' },
    '2500',
    { enabled: true, stockLocationId: fixture.stock, quantity: '2', unitPrice: '800', amountPaid: '600', paymentMode: 'mixed', businessDate: '2026-10-15', salespersonName: '  Ali  ', notes: ' First purchase ' },
    {}, undefined, {}, '', fixture.region,
  ]
})
afterEach(() => vi.restoreAllMocks())

describe('customer first-purchase form orchestration (offline)', () => {
  it('sends customer, opening due, selected region and salesperson through the single sale boundary', async () => {
    const tree = render()
    await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
    expect(fixture.submit).toHaveBeenCalledWith(expect.objectContaining({
      newCustomer: expect.objectContaining({ name: 'Retailer', region: 'Customer region', notes: 'Customer notes', openingBalancePkr: 2500 }),
      sellingRegion: fixture.region, stockLocationId: fixture.stock, salespersonName: 'Ali', notes: 'First purchase', amountPaid: 600, paymentMethod: 'credit', quantityKg: 2, unitPrice: 800,
    }))
    expect(fixture.submit.mock.calls[0][0]).not.toHaveProperty('createdBy')
    expect(fixture.createCustomer).not.toHaveBeenCalled()
    expect(tree.filter(node => node.type === 'input' && node.props.readOnly).some(node => node.props.value === 'Admin')).toBe(true)
  })
  it('keeps the frozen sale payload on an uncertain retry', async () => {
    await render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
    const original = fixture.submit.mock.calls[0][0]
    fixture.status = 'error'
    fixture.states[2] = { ...fixture.states[2], salespersonName: 'Changed name', quantity: '7' }
    await render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
    expect(fixture.submit.mock.calls[1][0]).toBe(original)
    expect(fixture.createCustomer).not.toHaveBeenCalled()
  })
  it('clears regional product values without discarding customer, salesperson or payment on region change', () => {
    const tree = render()
    tree.find(node => node.type === SellingRegionSelector)!.props.onChange('another-region')
    expect(fixture.states[2]).toMatchObject({ stockLocationId: '', quantity: '', unitPrice: '', salespersonName: '  Ali  ', amountPaid: '600' })
    expect(fixture.states[0].name).toBe('Retailer')
  })
})

it('creates only the customer and opening Khata when arriving from Add Daily Sale, even with enabled first-sale state', async () => {
  fixture.fromSale = true
  fixture.createCustomer.mockResolvedValue({ customer: { id: fixture.stock, name: 'Retailer' } })
  const tree = render()
  expect(tree.some(node => node.type === 'input' && node.props.type === 'checkbox')).toBe(false)
  expect(tree.some(node => node.props.children === 'Complete your sale after returning to Sales. No first purchase will be created here.')).toBe(true)
  await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  expect(fixture.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Retailer', openingBalancePkr: 2500, notes: 'Customer notes', idempotencyKey: expect.any(String) }))
  expect(fixture.submit).not.toHaveBeenCalled()
  expect(fixture.saved).toHaveBeenCalledWith('Retailer', fixture.stock)
})
it('preserves the customer fields and opening balance on failure without returning to Sales', async () => {
  fixture.fromSale = true; fixture.createCustomer.mockRejectedValue(new Error('Offline'))
  await render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  expect(fixture.saved).not.toHaveBeenCalled()
  expect(fixture.states[0]).toMatchObject({ name: 'Retailer', notes: 'Customer notes', city: 'Customer city' })
  expect(fixture.states[1]).toBe('2500')
  expect(render().some(node => node.props.role === 'alert')).toBe(true)
})
it('prevents overlapping customer submissions from the sale handoff', async () => {
  fixture.fromSale = true
  let resolve!: (value: unknown) => void
  fixture.createCustomer.mockImplementation(() => new Promise(done => { resolve = done }))
  const first = render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  await render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  expect(fixture.createCustomer).toHaveBeenCalledTimes(1)
  resolve({ customer: { id: fixture.stock, name: 'Retailer' } }); await first
  expect(fixture.saved).toHaveBeenCalledTimes(1)
  expect(fixture.submit).not.toHaveBeenCalled()
})
