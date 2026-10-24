import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ states: [] as any[], cursor: 0, flow: undefined as any, back: vi.fn(), clear: vi.fn() }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useMemo: (read: () => unknown) => read(), useEffect: vi.fn(), useRef: (current: unknown) => ({ current }), useState: (initial: any) => { const i = f.cursor++; if (!(i in f.states)) f.states[i] = typeof initial === 'function' ? initial() : initial; return [f.states[i], (next: any) => { f.states[i] = typeof next === 'function' ? next(f.states[i]) : next }] } }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useLocation: () => ({ search: '', key: 'offline' }), useSearchParams: () => [new URLSearchParams(), vi.fn()] }))
vi.mock('./useSaleCustomerNavigation', () => ({ useSaleCustomerNavigation: () => ({ flow: f.flow, returnToSale: f.back, clearNavigationDraft: f.clear }) }))
vi.mock('../customer-ledger', () => ({ useCustomerDirectory: () => ({ data: { customers: [], pagination: { page: 1, pages: 1, total: 0 } } }) }))
vi.mock('./useSales', () => ({ useSales: () => ({ data: { sales: [] } }), useSalesSummary: () => ({}), useVoidSale: () => ({}) }))
import { CustomersPage } from '../customers/pages/CustomersPage'
import { SalesPage } from '../../pages/SalesPage'
import { AddCustomerModal } from '../customers/components/AddCustomerModal'
import { AddSaleModal } from './components/AddSaleModal'
import { initialSaleForm } from './saleForm'
const draft = { sellingRegion: '', form: { ...initialSaleForm(), notes: 'Unsaved notes' } }
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render(page: () => ReactNode) { f.cursor = 0; return nodes(page()) }
beforeEach(() => { f.states = []; f.flow = undefined; f.back.mockReset(); f.clear.mockReset() })
it('opens the existing customer modal automatically only for sale navigation and returns with the confirmed ID', () => {
  f.flow = { id: 'flow', stage: 'create-customer', draft }
  const modal = render(CustomersPage).find(n => n.type === AddCustomerModal)!
  expect(modal.props.fromSale).toBe(true)
  modal.props.onSaved('Same name', '507f1f77bcf86cd799439011')
  expect(f.back).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
})
it('routes modal cancellation to Back to Sale without inventing a customer', () => {
  f.flow = { id: 'flow', stage: 'create-customer', draft }
  render(CustomersPage).find(n => n.type === AddCustomerModal)!.props.onClose()
  expect(f.back).toHaveBeenCalledWith()
})
it('leaves direct customer visits unchanged and allows ordinary customer onboarding', () => {
  expect(render(CustomersPage).some(n => n.type === AddCustomerModal)).toBe(false)
  const add = render(CustomersPage).find(n => n.props.variant === 'primary' && Array.isArray(n.props.children) && n.props.children.includes(' Add Customer'))!
  add.props.onClick()
  expect(render(CustomersPage).find(n => n.type === AddCustomerModal)!.props.fromSale).toBe(false)
})
it('reopens Add Daily Sale with the restored draft and existing success toast, then clears context on close', () => {
  f.flow = { id: 'flow', stage: 'resume-sale', draft, createdCustomerId: '507f1f77bcf86cd799439011' }
  const modal = render(SalesPage).find(n => n.type === AddSaleModal)!
  expect(modal.props.initialDraft).toEqual(draft)
  expect(render(SalesPage).some(n => n.props.message === 'Customer was added successfully. Continue your sale.')).toBe(true)
  modal.props.onClose()
  expect(f.clear).toHaveBeenCalledOnce()
  expect(render(SalesPage).some(n => n.type === AddSaleModal)).toBe(false)
})
