import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, save: vi.fn(), invalidate: vi.fn(), cache: vi.fn(), categoriesError: false, regionsError: false, categories: ['Green Tea', 'Black Tea', 'Jasmine Tea', 'Herbal Blend', 'Other'], categoriesPending: false, categoriesFetching: false, categoryFailure: null as unknown, retryCategories: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(), useEffect: vi.fn(), useId: () => 'catalog',
  useState: (initial: any) => { const i = f.cursor++; if (!(i in f.states)) f.states[i] = initial; return [f.states[i], (next: any) => { f.states[i] = typeof next === 'function' ? next(f.states[i]) : next }] },
  useRef: (initial: any) => { const i = f.refCursor++; f.refs[i] ??= { current: initial }; return f.refs[i] },
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: f.invalidate, setQueryData: f.cache }) }))
vi.mock('./catalogProduct.api', async original => ({
  ...await original<typeof import('./catalogProduct.api')>(),
  saveCatalogProduct: f.save,
  useCatalogProductOptions: () => ({ categories: { data: f.categories, isError: f.categoriesError, isPending: f.categoriesPending, isFetching: f.categoriesFetching, error: f.categoryFailure, refetch: f.retryCategories }, regions: { data: [{ _id: 'r1', name: 'Islamabad', status: 'active' }, { _id: 'r2', name: 'Peshawar', status: 'active' }, { _id: 'r3', name: 'Inactive', status: 'inactive' }], isError: f.regionsError } }),
}))
import { CatalogCategoryError } from './catalogProduct.api'
import { CatalogProductModal, validateCatalogProduct, type CatalogDraft } from './components/CatalogProductModal'
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
const close = vi.fn(), saved = vi.fn()
const product = { _id: 'p1', name: 'Special Green Tea', teaType: 'Other', status: 'active', sellingPrice: 950, lowStockThreshold: 100 }
let pendingRegion = false, receivingRegionId: string | undefined
function render() { f.cursor = 0; f.refCursor = 0; return nodes(CatalogProductModal({ onClose: close, onSaved: saved, pendingRegion, receivingRegionId })) }
function change(name: string, value: string) { render().find(n => n.props.name === name)!.props.onChange({ target: { value } }) }
const submit = () => render().find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
function custom() { change('teaType', 'Other'); change('customName', product.name); change('sellingPrice', '950') }
const confirm = () => render().find(n => n.props.name === 'confirmed')!.props.onChange({ target: { checked: true } })
afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.stubGlobal('window', { confirm: vi.fn(() => true) })
  f.states = []; f.refs = []; pendingRegion = false; receivingRegionId = undefined
  f.categoriesError = false; f.regionsError = false
  f.categories = ['Green Tea', 'Black Tea', 'Jasmine Tea', 'Herbal Blend', 'Other']
  f.categoriesPending = false; f.categoriesFetching = false; f.categoryFailure = null; f.retryCategories.mockReset()
  f.save.mockReset().mockResolvedValue(product); f.invalidate.mockReset(); f.cache.mockReset(); close.mockReset(); saved.mockReset()
})

describe('catalog product modal (offline event harness)', () => {
  it('shows separate loading, failure and retry states without clearing entered form values', () => {
    f.categories = []; f.categoriesPending = true; f.categoriesFetching = true
    expect(render().some(n => n.props.role === 'status' && n.props.children === 'Loading supported categories...')).toBe(true)
    change('name', 'Preserved tea'); change('sellingPrice', '950'); change('lowStockThreshold', '25')
    f.categoriesPending = false; f.categoriesFetching = false; f.categoriesError = true
    f.categoryFailure = new CatalogCategoryError('The category endpoint was not found (404). Update or restart the backend with the current code, then retry.', 404)
    expect(render().find(n => n.props.role === 'alert')!.props.children.join('')).toContain('404')
    render().find(n => n.props.children === 'Retry categories')!.props.onClick()
    expect(f.retryCategories).toHaveBeenCalledWith({ cancelRefetch: false })
    f.categoriesFetching = true
    expect(render().some(n => n.props.children === 'Retry categories')).toBe(false)
    expect(render().some(n => n.props.role === 'alert')).toBe(false)
    f.categoriesFetching = false; f.categoriesError = false; f.categories = ['Green Tea', 'Other']
    for (const [name, value] of [['name', 'Preserved tea'], ['sellingPrice', '950'], ['lowStockThreshold', '25']]) expect(render().find(n => n.props.name === name)!.props.value).toBe(value)
    expect(render().some(n => n.type === 'option' && n.props.value === 'Other')).toBe(true)
  })
  it('shows a genuine empty state and prevents saving without inventing categories', async () => {
    f.categories = []
    expect(render().some(n => n.props.role === 'status' && n.props.children.join('').includes('No supported categories'))).toBe(true)
    expect(render().some(n => n.props.role === 'alert')).toBe(false)
    expect(render().filter(n => n.type === 'option' && ['Other', 'Green Tea'].includes(n.props.value))).toHaveLength(0)
    render().find(n => n.props.children === 'Reload categories')!.props.onClick()
    expect(f.retryCategories).toHaveBeenCalledWith({ cancelRefetch: false })
    expect(render().find(n => n.props.children === 'Save Product')!.props.disabled).toBe(true)
    await submit(); expect(f.save).not.toHaveBeenCalled()
  })
  it('does not invent Other when it is absent from the backend category model', () => {
    f.categories = ['Green Tea']
    expect(render().some(n => n.type === 'option' && n.props.value === 'Other')).toBe(false)
  })
  it('reveals custom fields immediately and preserves both names, price and stock on category switches', () => {
    expect(render().find(n => n.type === 'option' && n.props.value === 'Other')!.props.children).toBe('+ Other — Custom Product')
    change('name', 'Normal tea'); custom(); change('openingQuantityKg', '200')
    expect(render().some(n => n.props.name === 'receivingRegionId')).toBe(true)
    change('teaType', 'Green Tea')
    expect(render().find(n => n.props.name === 'name')!.props.value).toBe('Normal tea')
    expect(render().some(n => n.props.name === 'openingQuantityKg')).toBe(false)
    change('teaType', 'Other')
    expect(render().find(n => n.props.name === 'customName')!.props.value).toBe(product.name)
    expect(render().find(n => n.props.name === 'openingQuantityKg')!.props.value).toBe('200')
    expect(render().find(n => n.props.name === 'sellingPrice')!.props.value).toBe('950')
  })
  it.each(['', '0', '-1', '1.5', 'Infinity'])('rejects invalid custom price %s without erasing it', async price => {
    custom(); change('sellingPrice', price); await submit()
    expect(f.save).not.toHaveBeenCalled()
    expect(render().find(n => n.props.name === 'sellingPrice')!.props).toMatchObject({ value: price, 'aria-invalid': true })
  })
  it.each(['-1', '0.0001', 'Infinity', '9007199254740992'])('rejects unsupported opening quantity %s', async quantity => {
    custom(); change('openingQuantityKg', quantity); await submit()
    expect(f.save).not.toHaveBeenCalled()
  })
  it('requires a receiving region and genuine-stock confirmation only for immediate nonzero stock', async () => {
    custom(); change('openingQuantityKg', '200'); await submit()
    expect(f.save).not.toHaveBeenCalled()
    change('receivingRegionId', 'r3'); await submit(); expect(f.save).not.toHaveBeenCalled()
    change('receivingRegionId', 'r1'); confirm(); await submit()
    expect(f.save).toHaveBeenCalledWith(expect.objectContaining({ openingQuantityKg: 200, receivingRegionId: 'r1', openingStockConfirmed: true, sellingPrice: 950 }))
  })
  it('creates zero-stock custom products without a region or stock payload and updates catalog options', async () => {
    custom(); await submit()
    const body = f.save.mock.calls[0][0]
    expect(body).toMatchObject({ name: product.name, teaType: 'Other', sellingPrice: 950, idempotencyKey: expect.any(String) })
    expect(body).not.toHaveProperty('openingQuantityKg'); expect(body).not.toHaveProperty('receivingRegionId')
    expect(f.cache).toHaveBeenCalledWith(['regional', 'products'], expect.any(Function))
    expect(f.cache.mock.calls[0][1]([])).toEqual([product])
    expect(f.invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['regional'] }))
    const regionalRefresh = f.invalidate.mock.calls.find(call => call[0].queryKey[0] === 'regional')![0]
    expect(regionalRefresh.predicate({ queryKey: ['regional', 'product-options'] })).toBe(false)
    expect(regionalRefresh.predicate({ queryKey: ['regional', 'products'] })).toBe(true)
    expect(saved).toHaveBeenCalledWith({ product, pendingOpeningKg: 0 })
  })
  it('keeps stock in the pending Add Region draft and creates only the catalog definition', async () => {
    pendingRegion = true; custom(); change('openingQuantityKg', '200'); await submit()
    expect(render().some(n => n.props.name === 'receivingRegionId')).toBe(false)
    expect(f.save.mock.calls[0][0]).not.toHaveProperty('openingQuantityKg')
    expect(saved).toHaveBeenCalledWith({ product, pendingOpeningKg: 200 })
  })
  it('preserves the normal category workflow and omits hidden opening stock', async () => {
    custom(); change('openingQuantityKg', '200'); change('teaType', 'Green Tea'); change('name', 'Normal tea')
    await submit()
    expect(f.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Normal tea', teaType: 'Green Tea', sellingPrice: 950 }))
    expect(f.save.mock.calls[0][0]).not.toHaveProperty('openingQuantityKg')
  })
  it('blocks duplicate submissions and reuses the same frozen payload after uncertain failure', async () => {
    let reject!: (error: Error) => void
    f.save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    custom(); const pending = submit(); await submit(); expect(f.save).toHaveBeenCalledTimes(1)
    reject(new Error('private server detail')); await pending
    expect(render().find(n => n.props.role === 'alert')!.props.children).not.toContain('private server detail')
    expect(render().some(n => n.type === 'fieldset' && n.props.disabled)).toBe(true)
    await submit()
    expect(f.save.mock.calls[1][0]).toBe(f.save.mock.calls[0][0])
    expect(saved).toHaveBeenCalledOnce()
  })
  it('shows safe duplicate-name feedback and allows correcting a rejected request', async () => {
    f.save.mockRejectedValueOnce(Object.assign(new Error('private'), { status: 409 }))
    custom(); await submit()
    expect(render().find(n => n.props.role === 'alert')!.props.children).toContain('already exists')
    expect(render().find(n => n.type === 'fieldset')!.props.disabled).toBe(false)
    change('customName', 'Another tea'); await submit()
    expect(f.save.mock.calls[1][0].name).toBe('Another tea')
    expect(f.save.mock.calls[1][0].idempotencyKey).not.toBe(f.save.mock.calls[0][0].idempotencyKey)
  })
  it('scopes receiving options to the existing region when supplied', () => {
    receivingRegionId = 'r1'; custom()
    const select = render().find(n => n.props.name === 'receivingRegionId')!
    expect(select.props.value).toBe('r1')
    expect(nodes(select).filter(n => n.type === 'option').map(n => n.props.value)).toEqual(['', 'r1'])
  })
  it('supports closing and validates missing names/category/status', async () => {
    custom(); change('customName', ' '); await submit(); expect(f.save).not.toHaveBeenCalled()
    render().find(n => n.props['aria-label'] === 'Close product form')!.props.onClick(); expect(close).toHaveBeenCalledOnce()
    const draft: CatalogDraft = { name: '', customName: '', teaType: 'Invalid', sellingPrice: '', lowStockThreshold: '-1', status: 'invalid', openingQuantityKg: '0', receivingRegionId: '' }
    expect(validateCatalogProduct(draft, ['Other'])).toMatchObject({ name: expect.any(String), teaType: expect.any(String), lowStockThreshold: expect.any(String), status: expect.any(String) })
  })
})

it('keeps catalog values when the owner cancels discarding a draft', () => {
  custom()
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  render().find(n => n.props['aria-label'] === 'Close product form')!.props.onClick()
  expect(close).not.toHaveBeenCalled()
  expect(render().find(n => n.props.name === 'customName')!.props.value).toBe(product.name)
  expect(window.confirm).toHaveBeenCalledOnce()
})
