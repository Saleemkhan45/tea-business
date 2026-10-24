import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, send: vi.fn(), saved: vi.fn(), pending: false, inventory: [] as any[] }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(), useEffect: vi.fn(),
  useState: (initial: any) => { const index = fixture.cursor++; if (!(index in fixture.states)) fixture.states[index] = typeof initial === 'function' ? initial() : initial; return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === 'function' ? next(fixture.states[index]) : next }] },
  useRef: (initial: unknown) => { const index = fixture.refCursor++; fixture.refs[index] ??= { current: initial }; return fixture.refs[index] },
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }), useMutation: (options: any) => ({ isPending: fixture.pending, isError: false, mutate: vi.fn(), mutateAsync: async (input: unknown) => { const result = await options.mutationFn(input); await options.onSuccess?.(result); return result } }) }))
vi.mock('../../components/shared', async importOriginal => ({ ...await importOriginal<object>(), useCloseOnEscape: vi.fn() }))
vi.mock('./regionalInventory.api', () => ({
  regionalRequest: fixture.send,
  useProducts: () => ({ data: Array.from({ length: 20 }, (_, index) => ({ _id: `item-${index}`, name: `Tea ${index}`, teaType: 'Green Tea', status: 'active', sellingPrice: 100, lowStockThreshold: 5 })), isPending: false, isError: false, refetch: vi.fn() }),
  useRegionalInventory: () => ({ data: fixture.inventory, isPending: false, isError: false, refetch: vi.fn() }),
}))
import { RegionEditor } from './components/RegionEditor'
import { RegionalConfigurationFields } from './components/RegionalConfigurationFields'
import type { LiveRegion } from './regionalInventory.api'

function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render(region?: LiveRegion) { fixture.cursor = 0; fixture.refCursor = 0; return nodes(RegionEditor({ region, onClose: vi.fn(), onSaved: fixture.saved })) }
function button(label: string) { return render().find(node => node.props.children === label)! }
function setName() { render().find(node => node.type === 'input' && node.props.required)!.props.onChange({ target: { value: 'Islamabad' } }) }
function addRow(index: number, quantity = '1') {
  button('+ Add Another Product').props.onClick()
  render().find(node => node.props.ariaLabel === `Tea product ${index + 1}`)!.props.onChange(`item-${index}`)
  render().filter(node => node.type === 'input' && node.props.type === 'number')[index].props.onChange({ target: { value: quantity } })
}
function confirm() { render().find(node => node.type === 'input' && node.props.type === 'checkbox')!.props.onChange({ target: { checked: true } }) }
const submit = async (region?: LiveRegion) => render(region).find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
beforeEach(() => { fixture.states = []; fixture.refs = []; fixture.pending = false; fixture.inventory = []; fixture.send.mockReset(); fixture.saved.mockReset() })

describe('Add Region form events (offline hook harness)', () => {
  it('loads selected defaults and preserves independent overrides when another row is removed', async () => {
    setName(); addRow(0); addRow(1)
    const fields = () => render().filter(node => node.type === RegionalConfigurationFields)
    expect(fields()[0].props).toMatchObject({ selected: true, catalogPrice: 100, catalogThreshold: 5 })
    fields()[0].props.onChange({ price: '850', threshold: '0' })
    fields()[1].props.onChange({ price: '800', threshold: '50' })
    render().find(node => node.props['aria-label'] === 'Remove product 1')!.props.onClick()
    expect(fields()[0].props.draft).toEqual({ price: '800', threshold: '50' })
    confirm(); await submit()
    expect(fixture.send.mock.calls[0][1].openingProducts).toEqual([{ itemId: 'item-1', quantityKg: 1, sellingPriceOverride: 800, lowStockThresholdOverride: 50 }])
  })
  it('clears prior product overrides when changing the selected catalog product', () => {
    setName(); addRow(0)
    render().find(node => node.type === RegionalConfigurationFields)!.props.onChange({ price: '850', threshold: '50' })
    render().find(node => node.props.ariaLabel === 'Tea product 1')!.props.onChange('item-1')
    expect(render().find(node => node.type === RegionalConfigurationFields)!.props.draft).toEqual({ price: '', threshold: '' })
  })
  it('sends a region with no products', async () => {
    setName(); await submit()
    expect(fixture.send).toHaveBeenCalledWith('/regions', expect.objectContaining({ name: 'Islamabad', openingProducts: [], idempotencyKey: expect.any(String) }), 'POST')
  })
  it('adds 20 different products, calculates exact totals and disables further rows', async () => {
    setName()
    for (let index = 0; index < 20; index++) addRow(index, '0.001')
    expect(button('+ Add Another Product').props.disabled).toBe(true)
    const summary = render().find(node => node.type === 'p' && node.props.role === 'status' && Array.isArray(node.props.children))!
    expect(summary.props.children.join('')).toContain('0.02 kg')
    confirm(); await submit()
    expect(fixture.send.mock.calls[0][1].openingProducts).toHaveLength(20)
    expect(fixture.saved).toHaveBeenCalledOnce()
  })
  it('removes a draft row and prevents choosing an already selected product', () => {
    setName(); addRow(0); button('+ Add Another Product').props.onClick()
    const selector = render().find(node => node.props.ariaLabel === 'Tea product 2')!
    expect(selector.props.options.some((option: { value: string }) => option.value === 'item-0')).toBe(false)
    render().find(node => node.props['aria-label'] === 'Remove product 1')!.props.onClick()
    expect(render().filter(node => node.type === 'input' && node.props.type === 'number')).toHaveLength(1)
  })
  it('keeps invalid input and refuses saving until corrected; supports zero', async () => {
    setName(); addRow(0, '-1'); await submit()
    expect(fixture.send).not.toHaveBeenCalled()
    expect(render().find(node => node.type === 'input' && node.props.type === 'number')!.props.value).toBe('-1')
    render().find(node => node.type === 'input' && node.props.type === 'number')!.props.onChange({ target: { value: '0' } })
    await submit()
    expect(fixture.send.mock.calls[0][1].openingProducts).toEqual([{ itemId: 'item-0', quantityKg: 0 }])
  })
  it('retries the exact payload and key after an uncertain result', async () => {
    fixture.send.mockRejectedValueOnce(new TypeError('Network failed'))
    setName(); addRow(0); confirm(); await submit()
    const first = fixture.send.mock.calls[0][1]
    expect(render().some(node => node.type === 'fieldset' && node.props.disabled)).toBe(true)
    await submit()
    expect(fixture.send.mock.calls[1][1]).toBe(first)
  })
  it('keeps entered rows editable after a definitive rejection', async () => {
    fixture.send.mockRejectedValueOnce(Object.assign(new Error('Name exists'), { status: 409 }))
    setName(); addRow(0); confirm(); await submit()
    expect(render().filter(node => node.type === 'fieldset').every(node => !node.props.disabled)).toBe(true)
    expect(render().find(node => node.type === 'input' && node.props.type === 'number')!.props.value).toBe('1')
  })
  it('disables save and blocks duplicate submission while pending', async () => {
    setName(); fixture.pending = true
    expect(button('Saving...').props.disabled).toBe(true)
    await submit(); expect(fixture.send).not.toHaveBeenCalled()
  })
  it('edits region details with read-only inventory and no opening-stock payload', async () => {
    const region: LiveRegion = { _id: 'region-1', name: 'Islamabad', status: 'active' }
    fixture.inventory = [{ id: 'stock', itemId: 'item-0', name: 'Tea', availableKg: 5, status: 'available' }]
    expect(render(region).some(node => node.type === 'input' && node.props.type === 'number')).toBe(false)
    await submit(region)
    expect(fixture.send).toHaveBeenCalledWith('/regions/region-1', expect.objectContaining({ name: 'Islamabad' }), 'PATCH')
    expect(fixture.send.mock.calls[0][1]).not.toHaveProperty('openingProducts')
  })
})

it('preserves the unsaved region and opening quantities across catalog creation', () => {
  setName(); addRow(0, '12.5')
  button('+ Catalog Product').props.onClick()
  const modal = render().find(node => node.type === CatalogProductModal)!
  expect(modal).toBeDefined()
  modal.props.onSaved({ product: { _id: 'item-19', name: 'New tea', teaType: 'Other', status: 'active', sellingPrice: 950 }, pendingOpeningKg: 200 })
  expect(render().some(node => node.type === CatalogProductModal)).toBe(false)
  expect(render().find(node => node.type === 'input' && node.props.required)!.props.value).toBe('Islamabad')
  expect(render().find(node => node.type === 'input' && node.props.type === 'number')!.props.value).toBe('12.5')
  expect(render().find(node => node.props.ariaLabel === 'Tea product 1')!.props.value).toBe('item-0')
  expect(render().find(node => node.props.ariaLabel === 'Tea product 2')!.props.value).toBe('item-19')
  expect(render().filter(node => node.type === 'input' && node.props.type === 'number')[1].props.value).toBe('200')
  expect(fixture.send).not.toHaveBeenCalled()
})
import { CatalogProductModal } from './components/CatalogProductModal'

it('records a catalog-created draft quantity only in the final Save Region request', async () => {
  setName(); addRow(0, '12.5')
  button('+ Catalog Product').props.onClick()
  const modal = render().find(node => node.type === CatalogProductModal)!
  expect(modal.props.pendingRegion).toBe(true)
  modal.props.onSaved({ product: { _id: 'item-19', name: 'New Tea', status: 'active' }, pendingOpeningKg: 200 })
  expect(fixture.send).not.toHaveBeenCalled()
  confirm(); await submit()
  expect(fixture.send).toHaveBeenCalledTimes(1)
  expect(fixture.send.mock.calls[0][1].openingProducts).toEqual([{ itemId: 'item-0', quantityKg: 12.5 }, { itemId: 'item-19', quantityKg: 200 }])
})
it('does not select inactive catalog products in a pending region or add an extra row', () => {
  setName(); button('+ Catalog Product').props.onClick()
  render().find(node => node.type === CatalogProductModal)!.props.onSaved({ product: { _id: 'inactive', status: 'inactive' }, pendingOpeningKg: 0 })
  expect(render().some(node => node.props.ariaLabel === 'Tea product 1')).toBe(false)
})
