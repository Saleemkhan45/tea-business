import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { acceptSession, clearSession, type AuthSession } from '../auth/auth.store'
import { initialSaleForm } from './saleForm'
import { createSaleCustomerFlow, finishSaleCustomerFlow, readSaleCustomerFlow, resumeSaleCustomerFlow, withoutSaleCustomerFlow } from './saleCustomerNavigation'
import { useSaleCustomerNavigation } from './useSaleCustomerNavigation'
// Use the real memory history behind useNavigate in this DOM-free harness:
// React Router deliberately disables its hook's navigation during SSR.
const history = vi.hoisted(() => ({ navigate: null as unknown as ReturnType<typeof createMemoryRouter>['navigate'] }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => history.navigate }))
vi.mock('../auth/auth.store', async original => {
  const actual = await original<typeof import('../auth/auth.store')>()
  return { ...actual, useAuthStore: Object.assign((selector: (state: ReturnType<typeof actual.useAuthStore.getState>) => unknown) => selector(actual.useAuthStore.getState()), actual.useAuthStore) }
})

const session: AuthSession = { user: { id: 'operator', name: 'Operator', email: 'operator@example.invalid', role: 'admin', shopId: 'shop', shopName: 'Offline Shop' }, csrfToken: 'offline', expiresAt: '2099-01-01T00:00:00.000Z' }
const id = '507f1f77bcf86cd799439011'
const draft = { sellingRegion: id, form: { ...initialSaleForm(), businessDate: '2026-10-16', stockLocationId: id, teaType: 'green' as const, quantity: '2', unitPrice: '950', paymentMethod: 'credit' as const, amountPaid: '500', salespersonName: 'Ali', notes: 'Keep this note' } }
let navigation!: ReturnType<typeof useSaleCustomerNavigation>
function Probe() { navigation = useSaleCustomerNavigation(); return null }
function makeRouter(state?: unknown, path = '/sales') {
  const router = createMemoryRouter([{ path: '/sales', element: <Probe /> }, { path: '/customers', element: <Probe /> }], { initialEntries: [{ pathname: path, state }] })
  history.navigate = router.navigate
  return router
}
beforeEach(() => acceptSession(session))
afterEach(clearSession)

describe('sale/customer history navigation, offline memory router', () => {
  it('preserves the complete draft and rejects another user/shop/session or malformed history state', () => {
    const flow = createSaleCustomerFlow(draft, session), state = { saleCustomerFlow: flow }
    expect(readSaleCustomerFlow(state, session)?.draft).toEqual(draft)
    expect(readSaleCustomerFlow(state, null)).toBeUndefined()
    for (const changed of [{ ...session, user: { ...session.user, shopId: 'other' } }, { ...session, user: { ...session.user, id: 'other' } }, { ...session, expiresAt: '2098-01-01T00:00:00.000Z' }]) expect(readSaleCustomerFlow(state, changed)).toBeUndefined()
    expect(readSaleCustomerFlow({ saleCustomerFlow: { ...flow, draft: {} } }, session)).toBeUndefined()
    expect(withoutSaleCustomerFlow({ ...state, unrelated: true })).toEqual({ unrelated: true })
  })
  it('navigates to Customers and preserves a resumable original Sales entry for browser Back', async () => {
    const router = makeRouter()
    try {
      renderToStaticMarkup(<RouterProvider router={router} />)
      navigation.beginCustomerCreation(draft)
      expect(router.state.location.pathname).toBe('/customers')
      expect(router.state.location.search).toBe('')
      expect(readSaleCustomerFlow(router.state.location.state, session)?.stage).toBe('create-customer')
      await router.navigate(-1)
      expect(router.state.location.pathname).toBe('/sales')
      expect(readSaleCustomerFlow(router.state.location.state, session)).toMatchObject({ stage: 'resume-sale', draft })
    } finally { router.dispose() }
  })
  it('returns after confirmed creation by ID and replaces the customer entry to avoid a navigation loop', async () => {
    const router = makeRouter()
    try {
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.beginCustomerCreation(draft)
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.returnToSale(id)
      const flow = readSaleCustomerFlow(router.state.location.state, session)!
      expect(router.state.location.pathname).toBe('/sales')
      expect(flow).toMatchObject({ stage: 'resume-sale', createdCustomerId: id, draft: { form: { customerId: id, customerName: '', quantity: '2', amountPaid: '500' } } })
      await router.navigate(-1)
      expect(router.state.location.pathname).toBe('/sales')
    } finally { router.dispose() }
  })
  it('cancels back to the unchanged draft and rehydrates the navigation snapshot after refresh', () => {
    const flow = createSaleCustomerFlow(draft, session)
    const router = makeRouter(JSON.parse(JSON.stringify({ saleCustomerFlow: flow })), '/customers')
    try {
      renderToStaticMarkup(<RouterProvider router={router} />)
      expect(navigation.flow?.stage).toBe('create-customer')
      navigation.returnToSale()
      expect(readSaleCustomerFlow(router.state.location.state, session)?.draft).toEqual(draft)
      expect(resumeSaleCustomerFlow(flow).createdCustomerId).toBeUndefined()
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.clearNavigationDraft()
      expect(readSaleCustomerFlow(router.state.location.state, session)).toBeUndefined()
    } finally { router.dispose() }
  })
  it('does not restore a completed sale workflow from an older Back history entry', async () => {
    const router = makeRouter()
    try {
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.beginCustomerCreation(draft)
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.returnToSale(id)
      renderToStaticMarkup(<RouterProvider router={router} />); navigation.clearNavigationDraft()
      await router.navigate(-1)
      expect(readSaleCustomerFlow(router.state.location.state, session)).toBeUndefined()
    } finally { router.dispose() }
  })
  it('stores only completion metadata in session storage and tolerates unavailable storage', () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', { sessionStorage: { getItem: () => null, setItem } })
    try {
      const flow = createSaleCustomerFlow(draft, session)
      finishSaleCustomerFlow(flow)
      expect(JSON.parse(setItem.mock.calls[0][1])).toEqual([{ id: flow.id, expiresAt: session.expiresAt }])
      expect(setItem.mock.calls[0][1]).not.toContain(draft.form.notes)
      expect(setItem.mock.calls[0][1]).not.toContain('csrf')
      setItem.mockImplementation(() => { throw new Error('Storage disabled') })
      expect(() => finishSaleCustomerFlow(flow)).not.toThrow()
    } finally { vi.unstubAllGlobals() }
  })
})
