import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, send: vi.fn(), saved: vi.fn(), closed: vi.fn(), failed: false, apiError: null as any, check: vi.fn(), read: vi.fn(), viewed: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(), useEffect: vi.fn(),
  useState: (initial: any) => { const index = fixture.cursor++; if (!(index in fixture.states)) fixture.states[index] = typeof initial === 'function' ? initial() : initial; return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === 'function' ? next(fixture.states[index]) : next }] },
  useRef: (initial: unknown) => { const index = fixture.refCursor++; fixture.refs[index] ??= { current: initial }; return fixture.refs[index] },
}))
vi.mock('@tanstack/react-query', () => ({ useMutation: (options: any) => ({ isPending: false, isError: fixture.failed, reset: () => { fixture.failed = false; fixture.apiError = null }, error: fixture.apiError ?? new Error('Save failed'), mutateAsync: async (input: unknown) => { try { const value = await options.mutationFn(input); options.onSuccess?.(value); return value } catch (error) { fixture.failed = true; throw error } } }) }))
vi.mock('./supplier.api', () => ({ saveSupplier: fixture.send, reconcileSupplier: fixture.check, supplierRequest: fixture.read, supplierSchema: { parse: (value: unknown) => value } }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: 'region', name: 'Islamabad' }, { _id: 'last-region', name: 'Karkhano' }] }), useProducts: () => ({ data: [{ _id: 'product', name: 'Green Tea', teaType: 'Green' }] }) }))
import { AddSupplierModal } from './components/AddSupplierModal'
const supplier = { _id: 'supplier', name: 'Original', contactPerson: 'Contact', phone: '+923001234567', alternatePhone: '', email: 'a@b.com', city: 'City', address: 'Street', notes: 'Retain notes', regions: ['region'], products: ['product'], productOfferings: ['Special Blend'], status: 'active' as const, revision: 2 }
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render(editing = true) { fixture.cursor = 0; fixture.refCursor = 0; return nodes(AddSupplierModal({ supplier: editing ? supplier : undefined, onClose: fixture.closed, onSave: fixture.saved, onViewExisting: fixture.viewed })) }
const submit = async () => render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
beforeEach(() => { fixture.states = []; fixture.refs = []; fixture.failed = false; fixture.send.mockReset(); fixture.saved.mockReset(); fixture.closed.mockReset(); fixture.apiError = null; fixture.check.mockReset(); fixture.read.mockReset(); fixture.viewed.mockReset() })
describe('supplier form event behavior (offline)', () => {
  it('prefills the actual record and existing product and region selections', () => {
    const tree = render()
    expect(tree.find(node => node.type === 'input' && node.props.value === 'Original')).toBeDefined()
    expect(tree.filter(node => node.type === 'input' && node.props.type === 'checkbox').map(node => node.props.checked)).toEqual([true, false, true])
    expect(fixture.states[0]).toMatchObject({ notes: 'Retain notes', email: 'a@b.com' })
  })
  it('retains changed fields after failure, then saves with the original revision', async () => {
    render(); fixture.states[0] = { ...fixture.states[0], name: 'Edited', notes: 'Preserved draft' }
    fixture.send.mockRejectedValueOnce(new Error('Failed'))
    await submit()
    expect(fixture.saved).not.toHaveBeenCalled()
    expect(fixture.states[0]).toMatchObject({ name: 'Edited', notes: 'Preserved draft' })
    fixture.send.mockResolvedValueOnce({ ...supplier, name: 'Edited' })
    await submit()
    expect(fixture.send.mock.calls[1]).toEqual([expect.objectContaining({ name: 'Edited', notes: 'Preserved draft' }), supplier, undefined])
    expect(fixture.saved).toHaveBeenCalledOnce()
  })
  it('blocks duplicate submissions while the first save is pending', async () => {
    let resolve!: () => void
    fixture.send.mockReturnValue(new Promise<void>(done => { resolve = done }))
    const pending = submit(); await submit()
    expect(fixture.send).toHaveBeenCalledOnce()
    resolve(); await pending
  })
  it('creates with optional contacts and no invented quantities', () => {
    render(false)
    expect(fixture.states[0]).toMatchObject({ name: '', email: '', phone: '', regions: [], products: [] })
    expect(fixture.states[0]).not.toHaveProperty('quantityKg')
  })
  it('keeps every field in the body and the footer outside that scrolling body', () => {
    const tree = render(false)
    expect(tree.find(node => node.props.role === 'dialog')?.props['aria-labelledby']).toBe('supplier-form-title')
    const form = tree.find(node => node.type === 'form')!
    const [body, footer] = form.props.children
    expect(body.props.className).toBe('supplier-form-body')
    expect(footer.type).toBe('footer')
    const bodyNodes = nodes(body)
    expect(bodyNodes.filter(node => ['input', 'textarea', 'select'].includes(node.type as string))).toHaveLength(14)
    expect(bodyNodes.some(node => node.type === 'textarea' && node.props.maxLength === 2000)).toBe(true)
    expect(bodyNodes.some(node => node.type === 'select' && node.props.value === 'active')).toBe(true)
    expect(bodyNodes.some(node => node.type === 'footer')).toBe(false)
    expect(nodes(footer).filter(node => node.props.children === 'Cancel' || node.props.children === 'Save Supplier')).toHaveLength(2)
  })
  it('renders the final region as a labelled checkbox and retains multiple selections across rerenders', () => {
    const tree = render()
    const regionLabel = tree.find(node => node.type === 'label' && nodes(node).some(child => child.props.type === 'checkbox') && node.props.children?.includes('Karkhano'))!
    const checkbox = nodes(regionLabel).find(node => node.props.type === 'checkbox')!
    checkbox.props.onChange()
    expect(fixture.states[0].regions).toEqual(['region', 'last-region'])
    const next = render()
    const checkboxes = next.filter(node => node.type === 'input' && node.props.type === 'checkbox')
    expect(checkboxes.map(node => node.props.checked)).toEqual([true, true, true])
  })
  it('retains the final Notes input and API errors inside the scrolling body', async () => {
    render(); fixture.send.mockRejectedValueOnce(new Error('Save failed'))
    await submit()
    const body = render().find(node => node.props.className === 'supplier-form-body')!
    const alert = nodes(body).find(node => node.props.role === 'alert')!
    expect(nodes(alert).some(node => node.props.children === 'Save failed')).toBe(true)
    expect(nodes(body).find(node => node.type === 'textarea' && node.props.maxLength === 2000)?.props.value).toBe('Retain notes')
  })
  it('keeps Cancel and Close functional', () => {
    let tree = render()
    tree.find(node => node.props.children === 'Cancel')!.props.onClick()
    expect(fixture.closed).toHaveBeenCalledOnce()
    tree = render()
    tree.find(node => node.props['aria-label'] === 'Close supplier form')!.props.onClick()
    expect(fixture.closed).toHaveBeenCalledTimes(2)
  })
  it('prefills manual offerings, adds/removes rows and rejects duplicate names before saving', async () => {
    let tree = render()
    expect(tree.some(node => node.props.value === 'Special Blend')).toBe(true)
    tree.find(node => node.props.children === '+ Add Another Product')!.props.onClick()
    expect(fixture.states[0].productOfferings).toEqual(['Special Blend', ''])
    tree = render()
    const offerings = tree.find(node => node.props.className === 'form-field form-field-wide supplier-offerings')!
    nodes(offerings).find(node => node.type === 'input' && node.props.value === '')!.props.onChange({ target: { value: '  special   blend ' } })
    fixture.states[0].productOfferings[1] = '  special   blend '
    await submit()
    expect(fixture.send).not.toHaveBeenCalled()
    expect(fixture.states[2]).toContain('unique')
    tree = render()
    tree.find(node => node.props['aria-label'] === 'Remove product 2')!.props.onClick()
    await submit()
    expect(fixture.send).toHaveBeenCalledWith(expect.objectContaining({ productOfferings: ['Special Blend'] }), supplier, undefined)
  })
  it('does not resend an uncertain save and performs read-only reconciliation', async () => {
    fixture.apiError = Object.assign(new Error('Saving could not be confirmed.'), { outcomeUncertain: true })
    fixture.send.mockRejectedValueOnce(fixture.apiError)
    // Creation gets a supplier-specific key, never a purchase operation key.
    render(false)
    const event = { preventDefault: vi.fn() }
    await render(false).find(node => node.type === 'form')!.props.onSubmit(event)
    const key = fixture.send.mock.calls[0][2]
    expect(key).toEqual(expect.any(String))
    fixture.check.mockResolvedValue({ status: 'unconfirmed' })
    await render(false).find(node => node.type === 'form')!.props.onSubmit(event)
    expect(fixture.send).toHaveBeenCalledOnce()
    await render(false).find(node => node.props.children === 'Check Saved Supplier (read-only)')!.props.onClick()
    // The click invokes an async function without awaiting it.
    await Promise.resolve(); await Promise.resolve()
    expect(fixture.check).toHaveBeenCalledWith(key)
    expect(fixture.send).toHaveBeenCalledOnce(); expect(fixture.saved).not.toHaveBeenCalled()
    expect(fixture.states[4].message).toContain('still unconfirmed')
  })
  it('offers a shop-scoped existing supplier action on a definite duplicate', async () => {
    fixture.apiError = Object.assign(new Error('A supplier with this name already exists.'), { existingSupplierId: 'existing' })
    fixture.send.mockRejectedValueOnce(fixture.apiError)
    await submit()
    render().find(node => node.props.children === 'View Existing Supplier')!.props.onClick()
    expect(fixture.viewed).toHaveBeenCalledWith('existing')
  })
  it('clears a stale duplicate message when the supplier name changes without sending another request', async () => {
    fixture.apiError = Object.assign(new Error('A supplier with this name already exists.'), { code: 'SUPPLIER_ALREADY_EXISTS', existingSupplierId: 'existing' })
    fixture.send.mockRejectedValueOnce(fixture.apiError)
    await submit()
    const tree = render()
    expect(tree.some(node => node.props.role === 'alert')).toBe(true)
    tree.find(node => node.type === 'input' && node.props.value === 'Original')!.props.onChange({ target: { value: 'Different supplier' } })
    expect(render().some(node => node.props.role === 'alert')).toBe(false)
    expect(fixture.states[0].name).toBe('Different supplier')
    expect(fixture.send).toHaveBeenCalledOnce()
  })
  it('retains the operation key for a safe retry and creates a fresh key for a new dialog', async () => {
    const submitCreation = () => render(false).find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
    fixture.send.mockRejectedValueOnce(Object.assign(new Error('Invalid phone'), { code: 'SUPPLIER_VALIDATION_FAILED', status: 400 }))
    await submitCreation()
    const firstKey = fixture.send.mock.calls[0][2]
    const tree = render(false)
    tree.find(node => node.type === 'input' && node.props.required)!.props.onChange({ target: { value: 'Corrected Supplier' } })
    await submitCreation()
    expect(fixture.send.mock.calls[1][2]).toBe(firstKey)
    expect(fixture.send.mock.calls[1][0].name).toBe('Corrected Supplier')
    // The page closes the confirmed dialog; a later Add Supplier mounts new refs/state.
    fixture.states = []; fixture.refs = []
    await submitCreation()
    expect(fixture.send.mock.calls[2][2]).toEqual(expect.any(String))
    expect(fixture.send.mock.calls[2][2]).not.toBe(firstKey)
  })
  it('does not clear uncertainty or change the draft when a field event arrives after an uncertain save', async () => {
    fixture.apiError = Object.assign(new Error('Unconfirmed'), { outcomeUncertain: true })
    fixture.send.mockRejectedValueOnce(fixture.apiError)
    await submit()
    render().find(node => node.type === 'input' && node.props.value === 'Original')!.props.onChange({ target: { value: 'Changed' } })
    expect(fixture.states[0].name).toBe('Original')
    expect(fixture.states[3]).toBe(true)
    await submit()
    expect(fixture.send).toHaveBeenCalledOnce()
  })
})

