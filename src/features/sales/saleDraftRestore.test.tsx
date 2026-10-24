import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], cursor: 0, refCursor: 0, effects: [] as Array<() => unknown>, refresh: vi.fn(), summaryError: false, active: true, availableKg: 20, regionActive: true, catalogFetching: false }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState: (initial: any) => { const i = f.cursor++; if (!(i in f.states)) f.states[i] = typeof initial === 'function' ? initial() : initial; return [f.states[i], (next: any) => { f.states[i] = typeof next === 'function' ? next(f.states[i]) : next }] }, useRef: (initial: any) => { const i = f.refCursor++; f.refs[i] ??= { current: initial }; return f.refs[i] }, useEffect: (effect: () => unknown) => f.effects.push(effect) }))
vi.mock('../../components/shared', async original => ({ ...await original<typeof import('../../components/shared')>(), useCloseOnEscape: vi.fn() }))
vi.mock('../../components/shared/useUnsavedEntryGuard', () => ({ useUnsavedEntryGuard: () => () => true }))
vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [{ _id: '507f1f77bcf86cd799439020', status: f.regionActive ? 'active' : 'inactive' }], refetch: f.refresh }) }))
vi.mock('../customer-ledger', () => ({ useCustomerLedgerSummary: () => ({ data: { summary: { currentBalancePkr: 2500 } }, isError: f.summaryError, refetch: f.refresh }), useCustomerById: () => ({ data: { customer: { status: f.active ? 'active' : 'inactive' } }, refetch: f.refresh }) }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (select: any) => select({ session: { user: { name: 'Operator' } } }) }))
vi.mock('./useSales', () => ({ useSaleEntryOptions: () => ({ isFetching: f.catalogFetching, data: { items: [{ id: '507f1f77bcf86cd799439021', regionId: '507f1f77bcf86cd799439020', teaType: 'green', availableKg: f.availableKg, sellingPrice: 950 }] }, refetch: f.refresh }) }))
import { SaleEntryForm } from './components/SaleEntryForm'
import { CustomerSelector } from './components/CustomerSelector'
import { initialSaleForm } from './saleForm'
import type { SaleDraft } from './saleCustomerNavigation'
const draft: SaleDraft = { sellingRegion: '507f1f77bcf86cd799439020', form: { ...initialSaleForm(), customerId: '507f1f77bcf86cd799439011', stockLocationId: '507f1f77bcf86cd799439021', teaType: 'green', quantity: '2', unitPrice: '950', paymentMethod: 'credit', amountPaid: '500', salespersonName: 'Ali', notes: 'Keep notes' } }
const submit = vi.fn(), add = vi.fn()
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render(locked = false) { f.cursor = 0; f.refCursor = 0; f.effects = []; return nodes(SaleEntryForm({ initialDraft: draft, submitting: false, locked, error: null, onClose: vi.fn(), onSubmit: submit, onAddNewCustomer: add })) }
const save = () => render().find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
beforeEach(() => { f.states = []; f.refs = []; f.summaryError = false; f.active = true; f.availableKg = 20; f.regionActive = true; f.catalogFetching = false; f.refresh.mockReset().mockResolvedValue({}); submit.mockReset(); add.mockReset() })
it('restores raw sale inputs, refreshes current reads, and submits only an existing customer ID', async () => {
  expect(render().find(n => n.props.type === 'submit')!.props.disabled).toBe(true)
  const refresh = f.effects[0]; refresh()
  await vi.waitFor(() => expect(f.states[3]).toBe(true))
  expect(f.refresh).toHaveBeenCalledTimes(4)
  expect(render().find(n => n.props['aria-label'] === 'Quantity (kg)')!.props.value).toBe('2')
  expect(render().find(n => n.props['aria-label'] === 'Unit Price (PKR)')!.props.value).toBe('950')
  await save()
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ customerId: draft.form.customerId, sellingRegion: draft.sellingRegion, stockLocationId: draft.form.stockLocationId, quantityKg: 2, unitPrice: 950, amountPaid: 500, salespersonName: 'Ali', notes: 'Keep notes' }))
  expect(submit.mock.calls[0][0].newCustomer).toBeUndefined()
})
it.each(['stock', 'region', 'customer', 'balance', 'fetching'])('blocks stale or ineligible restored %s', async condition => {
  render(); f.states[3] = true
  if (condition === 'stock') f.availableKg = 1
  if (condition === 'region') f.regionActive = false
  if (condition === 'customer') f.active = false
  if (condition === 'balance') f.summaryError = true
  if (condition === 'fetching') f.catalogFetching = true
  expect(render().find(n => n.props.type === 'submit')!.props.disabled).toBe(true)
  await save(); expect(submit).not.toHaveBeenCalled()
})
it('hands off every entered sale field but refuses navigation while a sale intent is locked', () => {
  render().find(n => n.type === CustomerSelector)!.props.onAddNewCustomer()
  expect(add).toHaveBeenCalledWith(draft)
  add.mockClear(); render(true).find(n => n.type === CustomerSelector)!.props.onAddNewCustomer()
  expect(add).not.toHaveBeenCalled()
})
