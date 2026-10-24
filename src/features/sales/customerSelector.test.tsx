import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ states: [] as any[], cursor: 0, directory: { isPending: false, isFetching: false, isError: false, error: null as unknown, data: { customers: [] as any[], pagination: { pages: 1 } }, refetch: vi.fn() }, byId: vi.fn() }))
vi.mock('react-dom', () => ({ createPortal: (node: any) => node }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: vi.fn(), useLayoutEffect: vi.fn(), useRef: () => ({ current: null }), useId: () => "test-results", useState: (initial: any) => { const i = f.cursor++; if (!(i in f.states)) f.states[i] = typeof initial === 'function' ? initial() : initial; return [f.states[i], (value: any) => { f.states[i] = typeof value === 'function' ? value(f.states[i]) : value }] } }))
vi.mock('../customer-ledger', async original => ({ ...await original<typeof import('../customer-ledger')>(), useCustomerDirectory: vi.fn(() => f.directory), useCustomerById: f.byId }))
import { useCustomerDirectory } from '../customer-ledger'
import { CustomerSelector, customerMatchesSearch, moveCustomerHighlight } from './components/CustomerSelector'
const customer = { id: '507f1f77bcf86cd799439011', name: 'Ahmed Khan', phone: '0300 1234567', address: 'Main Road', region: 'Punjab', city: 'Lahore', status: 'active' as const, currentBalancePkr: 2500 }
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
const select = vi.fn(), add = vi.fn()
function render(value = '') { f.cursor = 0; return nodes(CustomerSelector({ value, onSelect: select, onAddNewCustomer: add })) }
beforeEach(() => { vi.stubGlobal('document', { body: {} }); vi.stubGlobal('window', { requestAnimationFrame: vi.fn() }); f.states = []; f.directory.isPending = false; f.directory.isError = false; f.directory.data.customers = []; f.byId.mockReset().mockReturnValue({ isError: false, data: { customer } }); select.mockReset(); add.mockReset() })
function search(query = 'Ahmed') { render().find(n => n.props.role === 'combobox')!.props.onChange({ target: { value: query } }); f.states[1] = query.trim(); return render() }

describe('existing-customer selector and navigation action', () => {
  it('does not request or display customers for an empty query', () => {
    f.directory.data.customers = [customer]
    expect(render().some(n => n.props.role === 'listbox')).toBe(false)
    expect(vi.mocked(useCustomerDirectory).mock.calls.at(-1)?.[1]).toBe(false)
  })
  it('bounds results and hides previous-query data during debounce', () => {
    f.directory.data.customers = Array.from({ length: 20 }, (_, i) => ({ ...customer, id: String(i) }))
    expect(search().filter(n => n.props.role === 'option')).toHaveLength(8)
    render().find(n => n.props.role === 'combobox')!.props.onChange({ target: { value: 'Khan' } })
    expect(render().filter(n => n.props.role === 'option')).toHaveLength(0)
    expect(render().some(n => n.props.children === 'Searching customers...')).toBe(true)
    expect(search('').some(n => n.props.role === 'listbox')).toBe(false)
  })
  it('offers Change Customer without changing the selected ID or other form values', () => {
    render(customer.id).find(n => n.props.className === 'sale-selection-summary')!.props.onClick()
    expect(render(customer.id).some(n => n.props.role === 'combobox')).toBe(true)
    expect(select).not.toHaveBeenCalled()
  })
  it('renders results in a fixed floating layer outside form layout', () => {
    expect(search().some(n => n.props.className === 'sale-customer-popover')).toBe(true)
  })
  it('delegates Add New Customer without rendering or staging an inline customer form', () => {
    const action = render().find(n => n.props.className === 'sale-add-customer-action')!
    action.props.onClick()
    expect(add).toHaveBeenCalledOnce()
    expect(render().some(n => n.props.className === 'sale-new-customer')).toBe(false)
    expect(select).not.toHaveBeenCalled()
  })
  it('selects duplicate names by their distinct backend IDs', () => {
    const other = { ...customer, id: '507f1f77bcf86cd799439012', phone: '0321 9876543' }
    f.directory.data.customers = [customer, other]
    const options = search().filter(n => n.props.role === 'option')
    expect(options).toHaveLength(2)
    options[1].props.onClick()
    expect(select).toHaveBeenCalledWith(other)
  })
  it('keeps customer search and Add New Customer visible after selecting an account', () => {
    const tree = render(customer.id)
    expect(f.byId).toHaveBeenCalledWith(customer.id)
    expect(tree.some(n => n.props.role === 'combobox')).toBe(false)
    expect(tree.some(n => n.props.className === 'sale-add-customer-action')).toBe(true)
    expect(tree.some(n => n.type === 'strong' && n.props.children === customer.name)).toBe(true)
  })
  it('supports partial case-insensitive names and supported phone search', () => {
    expect(customerMatchesSearch(customer, 'mED kH')).toBe(true)
    expect(customerMatchesSearch(customer, '1234')).toBe(true)
    expect(customerMatchesSearch(customer, 'Fatima')).toBe(false)
  })
  it('shows distinct loading, empty and failed directory states', () => {
    search(); expect(render().some(n => n.props.children === 'No customers found.')).toBe(true)
    f.directory.isPending = true
    expect(render().some(n => n.props.children === 'Searching customers...')).toBe(true)
    f.directory.isPending = false; f.directory.isError = true
    expect(render().some(n => n.props.role === 'alert')).toBe(true)
    expect(render().some(n => n.props.children === 'No customers found.')).toBe(false)
    render().find(n => n.props.children === 'Retry')!.props.onClick()
    expect(f.directory.refetch).toHaveBeenCalledOnce()
  })
  it('keeps keyboard result selection and closes search without closing the sale', () => {
    f.directory.data.customers = [customer]
    search()
    const event = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() })
    render().find(n => n.props.role === 'combobox')!.props.onKeyDown(event('ArrowDown'))
    render().find(n => n.props.role === 'combobox')!.props.onKeyDown(event('Enter'))
    expect(select).toHaveBeenCalledWith(customer)
    expect(render().some(n => n.props.role === 'listbox')).toBe(false)
    search()
    const escape = event('Escape')
    render().find(n => n.props.role === 'combobox')!.props.onKeyDown(escape)
    expect(escape.stopPropagation).toHaveBeenCalledOnce()
    expect(moveCustomerHighlight(2, 3, 'ArrowDown')).toBe(0)
    expect(moveCustomerHighlight(0, 3, 'ArrowUp')).toBe(2)
    expect(moveCustomerHighlight(0, 0, 'ArrowDown')).toBe(-1)
  })
})
