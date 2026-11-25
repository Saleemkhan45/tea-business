import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { CustomerLedgerTransaction, CustomerSummary, DailyPaymentBucket, LedgerRow, PaymentCalendarBucket } from '../../business/domain/customer-ledger.types'
import { CustomerSummaryCards } from './components/CustomerSummaryCards'
import { CustomerPaymentCalendar } from './components/CustomerPaymentCalendar'
import { CustomerLedgerTable } from './components/CustomerLedgerTable'
import { CustomerQuickActions } from './components/CustomerQuickActions'
import { CustomerPeriodPanel } from './components/CustomerProfilePanels'
import { AddCustomerModal } from './components/AddCustomerModal'
import { paymentChartData, calendarCells } from './utils/customerLedgerUi'
import * as shared from '../../components/shared'
import { CustomerLedgerApiError } from '../customer-ledger'
import type { CustomerProfile } from '../customer-ledger'

const queries = vi.hoisted(() => ({
  summary: vi.fn(), ledger: vi.fn(), daily: vi.fn(), insights: vi.fn(), calendar: vi.fn(), reminder: vi.fn(), directory: vi.fn(), profile: vi.fn(),
}))
vi.mock('../customer-ledger', async importOriginal => ({
  ...await importOriginal<typeof import('../customer-ledger')>(),
  useCustomerLedgerSummary: queries.summary,
  useCustomerLedger: queries.ledger,
  useCustomerLedgerDailyPayments: queries.daily,
  useCustomerLedgerPaymentInsights: queries.insights,
  useCustomerLedgerPaymentCalendar: queries.calendar,
  useCustomerLedgerReminderCandidate: queries.reminder,
  useCustomerDirectory: queries.directory,
  useCustomerById: queries.profile,
  useCreateCustomer: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useDeleteCustomer: vi.fn(() => ({ isPending: false, mutate: vi.fn(), reset: vi.fn(), error: null })),
  useCreateCustomerPurchase: vi.fn(),
  useCreateCustomerPayment: vi.fn(() => ({ isPending: false })),
}))
vi.mock('../sales/useSales', async importOriginal => ({
  ...await importOriginal<typeof import('../sales/useSales')>(),
  useSaleEntryOptions: () => ({ isPending: false, isError: false, data: { operator: { name: 'Admin' }, items: [] } }),
}))
vi.mock('../sales/useSaleSubmission', () => ({
  useSaleSubmission: () => ({ status: 'idle', error: null, hasActiveRequest: false, submit: vi.fn(), reset: vi.fn() }),
}))

import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { CustomersPage } from './pages/CustomersPage'

const customerId = '507f1f77bcf86cd799439011'
const noop = () => undefined

const summary: CustomerSummary = {
  customerId, totalPurchasedKg: 12.375, totalPurchasedPkr: 12000,
  totalPaidPkr: 4500, currentBalancePkr: 7500,
  purchaseCount: 2,
  lastPurchaseDate: '2026-10-02',
  productSummary: [
    {
      productName: 'Green Tea Classic',
      teaType: 'green',
      totalQuantityKg: 7,
      totalSpendingPkr: 7000,
      purchaseCount: 1,
      lastPurchaseDate: '2026-10-02',
    },
    {
      productName: 'Black Tea',
      teaType: 'black',
      totalQuantityKg: 5.375,
      totalSpendingPkr: 5000,
      purchaseCount: 1,
      lastPurchaseDate: '2026-09-28',
    },
  ],
  lastPaymentDate: '2026-10-01', daysSinceLastPayment: 1,
}

const row: LedgerRow = {
  transactionId: 'tx-1', businessDate: '2026-10-01', type: 'payment', teaType: null,
  quantityKg: null, ratePerKgPkr: null, amountPkr: 500, balanceImpactPkr: -500,
  paymentMethod: 'cash', runningBalancePkr: 7500, status: 'active', createdBy: 'operator-1', createdAt: '2026-10-01T12:00:00Z',
}

const purchaseTransaction: CustomerLedgerTransaction = {
  id: '507f1f77bcf86cd799439020',
  businessId: 'shop-1',
  customerId,
  type: 'purchase',
  businessDate: '2026-10-02',
  status: 'active',
  createdBy: 'operator-1',
  createdAt: '2026-10-02T12:00:00Z',
  updatedAt: '2026-10-02T12:00:00Z',
  notes: 'Counter sale',
  enteredByName: 'Admin',
  productName: 'Green Tea Classic',
  saleId: '507f1f77bcf86cd799439013',
  teaType: 'green',
  stockLocationId: '507f1f77bcf86cd799439014',
  quantityKg: 7,
  ratePerKgPkr: 1000,
  amountPkr: 7000,
}

const salePaymentTransaction: CustomerLedgerTransaction = {
  id: '507f1f77bcf86cd799439021',
  businessId: 'shop-1',
  customerId,
  type: 'payment',
  businessDate: '2026-10-02',
  status: 'active',
  createdBy: 'operator-1',
  createdAt: '2026-10-02T12:01:00Z',
  updatedAt: '2026-10-02T12:01:00Z',
  notes: null,
  saleId: '507f1f77bcf86cd799439013',
  amountPkr: 2000,
  paymentMethod: 'cash',
}

function renderDetail(id = customerId) {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[`/customers/${id}`]}><Routes><Route path="/customers/:customerId" element={<CustomerDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

function renderCustomers(route = '/customers') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[route]}><Routes><Route path="/customers" element={<CustomersPage />} /></Routes></MemoryRouter>)
}

function mockDefaultQueries() {
  const pending = { isPending: true, isError: false, refetch: noop }
  queries.summary.mockReturnValue(pending)
  queries.ledger.mockReturnValue(pending)
  queries.daily.mockReturnValue(pending)
  queries.insights.mockReturnValue(pending)
  queries.calendar.mockReturnValue(pending)
  queries.reminder.mockReturnValue(pending)
  queries.profile.mockReturnValue(pending)
}

function mockProfile(customer: CustomerProfile = {
  id: customerId, name: 'Ahmed Traders', phone: '+92 300 1112223',
  address: 'Main bazaar', status: 'active',
}) {
  queries.profile.mockReturnValue({
    isPending: false, isError: false, refetch: noop, data: { customer },
  })
}

function mockDirectory(overrides = {}) {
  queries.directory.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: noop,
    data: {
      customers: [{
        id: customerId,
        name: 'Ahmed Traders',
        phone: '+92 300 1112223',
        address: 'Main bazaar',
        status: 'active',
        currentBalancePkr: 12000,
      }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    },
    ...overrides,
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('customer ledger presentation', () => {
  it('renders an accessible add-customer dialog with supported contact fields', () => {
    const markup = renderToStaticMarkup(<AddCustomerModal onClose={noop} onSaved={noop} />)

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="add-customer-title"')
    expect(markup).toContain('aria-busy="false"')
    expect(markup).toContain('Customer Name')
    expect(markup).toContain('Phone Number')
    expect(markup).toContain('Address')
    expect(markup).toContain('required=""')
  })

  it('reports period purchases and payments using server balances without including later or reversed entries', () => {
    const transactions: CustomerLedgerTransaction[] = [
      purchaseTransaction,
      salePaymentTransaction,
      { ...salePaymentTransaction, id: 'later-payment', businessDate: '2026-11-01', amountPkr: 3000 },
      { ...purchaseTransaction, id: 'cancelled-purchase', amountPkr: 9000 },
      { ...purchaseTransaction, id: 'reversal', type: 'return', reversalOf: 'cancelled-purchase', amountPkr: 9000 },
    ]
    const markup = renderToStaticMarkup(<CustomerPeriodPanel transactions={transactions}
      rows={[{ ...row, businessDate: '2026-10-02', runningBalancePkr: 5500 }, { ...row, businessDate: '2026-11-01', runningBalancePkr: 2500 }]}
      from="2026-10-01" to="2026-10-31" isPending={false} isError={false} onRetry={noop} />)
    expect(markup).toContain('PKR 7,000')
    expect(markup).toContain('PKR 2,000')
    expect(markup).toContain('PKR 5,500')
    expect(markup).toContain('7 kg')
    expect(markup).not.toContain('PKR 9,000')
    expect(markup).not.toContain('PKR 3,000')
    expect(markup).not.toContain('PKR 2,500')
  })

  it('renders backend customers in the directory with links to detail pages', () => {
    mockDirectory()

    const markup = renderCustomers()

    expect(markup).toContain('Ahmed Traders')
    expect(markup).toContain('+92 300 1112223')
    expect(markup).toContain('PKR 12,000')
    expect(markup).toContain(`href="/customers/${customerId}"`)
    expect(markup).not.toContain('Customer directory not connected')
    expect(markup).toContain('Add Customer')
  })

  it('passes URL search, status and page filters to the customer directory query', () => {
    mockDirectory()

    renderCustomers('/customers?search=Ahmed&status=active&page=2')

    expect(queries.directory).toHaveBeenCalledWith({ search: 'Ahmed', status: 'active', page: 2, limit: 20 })
  })

  it('shows customer directory loading, empty, error and pagination states', () => {
    queries.directory.mockReturnValue({ isPending: true, isFetching: true, isError: false, refetch: noop })
    expect(renderCustomers()).toContain('Loading customers')

    queries.directory.mockReturnValue({ isPending: false, isFetching: false, isError: true, error: new Error('Directory failed'), refetch: noop })
    expect(renderCustomers()).toContain('Directory failed')

    mockDirectory({ data: { customers: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
    expect(renderCustomers()).toContain('No customers found')

    mockDirectory({
      data: {
        customers: [{
          id: customerId,
          name: 'Ahmed Traders',
          phone: '+92 300 1112223',
          address: 'Main bazaar',
          status: 'active',
          currentBalancePkr: 12000,
        }],
        pagination: { page: 2, limit: 20, total: 45, pages: 3 },
      },
    })
    expect(renderCustomers()).toContain('Page 2 of 3')
    expect(renderCustomers()).toContain('45 total')
  })

  it('renders API summary values, exact balance and three-decimal quantity labels', () => {
    const markup = renderToStaticMarkup(<CustomerSummaryCards summary={summary} />)
    expect(markup).toContain('Total Purchases')
    expect(markup).toContain('12.375 kg')
    expect(markup).toContain('PKR 7,500')
    expect(markup).toContain('Last paid 01 Oct 2026')
    expect(markup).toContain('Current Khata')
    expect(markup).toContain('Amount Due')
  })

  it('uses API daily totals without inventing missing values', () => {
    const markup = renderToStaticMarkup(<CustomerSummaryCards summary={{ ...summary, todayPurchasedPkr: 10000, todayPaidPkr: 4000 }} />)
    expect(markup).toContain('PKR 10,000')
    expect(markup).toContain('PKR 4,000')
    expect(markup).not.toContain('PKR 0')
    expect(renderToStaticMarkup(<CustomerSummaryCards summary={summary} />)).not.toContain('PKR 0')
  })

  it('renders Receive Payment with account context and a read-only operator', () => {
    const markup = renderToStaticMarkup(<CustomerQuickActions customerId={customerId} customerName="Ahmed Traders" outstandingPkr={26000} mode="payment" onClose={noop} onSuccess={noop} />)
    expect(markup).toContain('Receive Payment')
    expect(markup).toContain('Current Khata')
    expect(markup).toContain('PKR 26,000')
    expect(markup).toContain('readOnly="" value="Admin"')
    expect(markup).toContain('Record Payment')
    expect(markup).not.toContain(customerId)
    expect(markup).not.toContain('Stock Item')
  })

  it('disables payment when balance is unavailable and does not clamp a legacy negative balance', () => {
    const props = { customerId, mode: 'payment' as const, onClose: noop, onSuccess: noop }
    expect(renderToStaticMarkup(<CustomerQuickActions {...props} />)).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
    const markup = renderToStaticMarkup(<CustomerQuickActions {...props} outstandingPkr={-100} />)
    expect(markup).toContain('PKR -100')
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })

  it('retains zero-payment days and marks only the API highest day', () => {
    const buckets: DailyPaymentBucket[] = [
      { date: '2026-10-01', amountPkr: 0, transactionCount: 0 },
      { date: '2026-10-02', amountPkr: 1200, transactionCount: 1 },
    ]
    expect(paymentChartData(buckets, '2026-10-02')).toEqual([
      { ...buckets[0], isHighest: false, isZero: true },
      { ...buckets[1], isHighest: true, isZero: false },
    ])
  })

  it('renders zero-payment calendar days and neutral dates outside the range', () => {
    const buckets: PaymentCalendarBucket[] = [{ date: '2026-10-01', amountPkr: 0, transactionCount: 0, level: 'none' }]
    const cells = calendarCells('2026-10-01', '2026-10-01', '2026-10-01', buckets)
    expect(cells.find(cell => cell.date === '2026-10-01')?.bucket?.level).toBe('none')
    expect(cells.find(cell => cell.date === '2026-09-30')?.inRange).toBe(false)
    const markup = renderToStaticMarkup(<CustomerPaymentCalendar buckets={buckets} from="2026-10-01" to="2026-10-01" today="2026-10-02" isPending={false} isError={false} onPrevious={noop} onNext={noop} onRetry={noop} />)
    expect(markup).toContain('level-none')
    expect(markup).toContain('01 Oct 2026: PKR 0')
    expect(markup).toContain('level-no_data')
  })

  it('renders payment type, API running balance and voided audit state', () => {
    const active = renderToStaticMarkup(<CustomerLedgerTable rows={[row]} transactions={[]} filters={{}} today="2026-10-02" isPending={false} isError={false} onFiltersChange={noop} onRetry={noop} />)
    expect(active).toContain('Payment')
    expect(active).toContain('Received')
    expect(active).toContain('PKR 7,500')
    const voided = renderToStaticMarkup(<CustomerLedgerTable rows={[{ ...row, status: 'voided', balanceImpactPkr: 0 }]} transactions={[]} filters={{}} today="2026-10-02" isPending={false} isError={false} onFiltersChange={noop} onRetry={noop} />)
    expect(voided).toContain('is-voided')
    expect(voided).toContain('Voided')
    expect(voided).toContain('class="customer-debit"><strong>-</strong>')
    expect(voided).toContain('class="customer-credit"><strong>-</strong>')
  })

  it('shows the empty ledger state', () => {
    const markup = renderToStaticMarkup(<CustomerLedgerTable rows={[]} transactions={[]} filters={{}} today="2026-10-02" isPending={false} isError={false} onFiltersChange={noop} onRetry={noop} />)
    expect(markup).toContain('No ledger transactions')
  })

  it('renders customer identity from the single-customer response on the detail page', () => {
    mockDefaultQueries()
    mockProfile()
    const markup = renderDetail()
    expect(markup).toContain('Ahmed Traders')
    expect(markup).toContain('+92 300 1112223')
    expect(markup).toContain('Main bazaar')
    expect(markup).toContain('Active')
    expect(markup).not.toContain('Profile unavailable')
    expect(queries.profile).toHaveBeenCalledWith(customerId)
    expect(queries.directory).not.toHaveBeenCalled()
    expect(markup).toContain('Loading ledger')
  })

  it('renders customer profile information, product totals and immutable purchase history', () => {
    mockDefaultQueries()
    mockProfile({
      id: customerId,
      name: 'Ahmed Traders',
      phone: '+92 300 1112223',
      address: 'Main bazaar',
      region: 'Lahore',
      notes: 'Prefers weekly follow-up',
      createdAt: '2026-10-01T09:00:00.000Z',
      status: 'active',
    })
    queries.summary.mockReturnValue({ isPending: false, isError: false, data: { summary }, refetch: noop })
    queries.ledger.mockReturnValue({
      isPending: false,
      isError: false,
      data: { rows: [row], transactions: [purchaseTransaction, salePaymentTransaction] },
      refetch: noop,
    })

    const markup = renderDetail()

    expect(markup).toContain('Customer Information')
    expect(markup).toContain('Prefers weekly follow-up')
    expect(markup).toContain('01 Oct 2026')
    expect(markup).toContain('Financial Summary')
    expect(markup).toContain('Number of purchases')
    expect(markup).toContain('Product Purchase Summary')
    expect(markup).toContain('Green Tea Classic')
    expect(markup).toContain('Purchase History')
    expect(markup).toContain('SL-439013')
    expect(markup).toContain('PKR 5,000')
    expect(markup).toContain('Partial')
  })

  it.each([1, 200, 201, 1000])('resolves customer %i by ID independently of directory pagination', position => {
    const id = position.toString(16).padStart(24, '0')
    mockDefaultQueries()
    mockDirectory({ data: { customers: [], pagination: { page: 1, limit: 20, total: 1000, pages: 50 } } })
    mockProfile({ id, name: `Customer ${position}`, phone: '', address: '', status: 'active' })

    const markup = renderDetail(id)

    expect(markup).toContain(`Customer ${position}`)
    expect(markup).not.toContain('class="customer-id"')
    expect(queries.profile).toHaveBeenCalledWith(id)
    expect(queries.directory).not.toHaveBeenCalled()
  })

  it('shows inactive status without exposing IDs or fabricating missing contact fields', () => {
    mockDefaultQueries()
    mockProfile({ id: customerId, name: '', phone: '', address: '', status: 'inactive' })

    const markup = renderDetail()

    expect(markup).toContain('Customer account')
    expect(markup).not.toContain(customerId)
    expect(markup).toContain('Inactive')
    expect(markup).not.toContain('Main bazaar')
    expect(markup).not.toContain('+92 300 1112223')
  })

  it('keeps a safe account fallback while loading and after a profile error', () => {
    mockDefaultQueries()
    const loading = renderDetail()
    expect(loading).toContain('Loading customer profile')
    expect(loading).not.toContain(customerId)
    expect(loading).toContain('Customer account')

    queries.profile.mockReturnValue({ isPending: false, isError: true, error: new CustomerLedgerApiError('Customer not found.', 404), refetch: noop })
    const error = renderDetail()
    expect(error).toContain('Customer not found')
    expect(error).toContain('Customer not found in this shop.')
    expect(error).not.toContain(customerId)
    expect(error).toContain('Retry')
  })

  it('continues to render ledger-owned balances and rows when the profile request fails', () => {
    mockDefaultQueries()
    queries.profile.mockReturnValue({ isPending: false, isError: true, error: new Error('Profile failed'), refetch: noop })
    queries.summary.mockReturnValue({ isPending: false, isError: false, data: { summary }, refetch: noop })
    queries.ledger.mockReturnValue({ isPending: false, isError: false, data: { rows: [row], transactions: [] }, refetch: noop })

    const markup = renderDetail()

    expect(markup).not.toContain('Profile failed')
    expect(markup).toContain('Unable to load account data. Please try again.')
    expect(markup).toContain('PKR 7,500')
    expect(markup).toContain('12.375 kg')
    expect(markup).toContain('Payment')
    expect(markup).toContain('Received')
    expect(queries.summary).toHaveBeenCalledWith(customerId, expect.any(String))
    expect(queries.ledger).toHaveBeenCalledWith(customerId, {})
  })

  it('shows customer detail loading and error states', () => {
    mockDefaultQueries()
    expect(renderDetail()).toContain('Loading account summary')
    queries.summary.mockReturnValue({ isPending: false, isError: true, error: new Error('Summary failed'), refetch: noop })
    const errorMarkup = renderDetail()
    expect(errorMarkup).toContain('Account summary unavailable')
    expect(errorMarkup).not.toContain('Summary failed')
    expect(errorMarkup).toContain('Unable to load account data. Please try again.')
  })

  it.each([
    [400, 'Invalid customer request', 'The customer ID or request is invalid.'],
    [401, 'Session expired', 'Your session has expired. Sign in again.'],
    [404, 'Customer not found', 'Customer not found in this shop.'],
    [0, 'Customer profile unavailable', 'Unable to connect. Check your connection and try again.'],
    [503, 'Customer profile unavailable', 'Unable to load account data. Please try again.'],
  ])('renders a deliberate and safe profile state for status %i', (status, title, message) => {
    mockDefaultQueries()
    queries.profile.mockReturnValue({
      isPending: false, isError: true,
      error: new CustomerLedgerApiError('private backend message', Number(status)), refetch: noop,
    })

    const markup = renderDetail()

    expect(markup).toContain(title)
    expect(markup).toContain(message)
    expect(markup).not.toContain(customerId)
    expect(markup).not.toContain('private backend message')
    expect(markup).not.toContain('Balance due')
    expect(markup).not.toContain('PKR 0')
  })

  it('wires profile retry to only the profile request', () => {
    mockDefaultQueries()
    const refetch = vi.fn()
    queries.profile.mockReturnValue({ isPending: false, isError: true, error: new CustomerLedgerApiError('Network failed', 0), refetch })
    const states = vi.spyOn(shared, 'StateBlock')

    renderDetail()
    const props = states.mock.calls.find(([state]) => state.title === 'Customer profile unavailable')?.[0]
    const button = props?.action
    expect(isValidElement(button)).toBe(true)
    if (!isValidElement<{ onClick: () => void; 'aria-label': string }>(button)) throw new Error('Expected profile retry button.')
    expect(button.props['aria-label']).toBe('Retry customer profile')
    button.props.onClick()

    expect(refetch).toHaveBeenCalledOnce()
    expect(queries.ledger).toHaveBeenCalledOnce()
    expect(queries.summary).toHaveBeenCalledOnce()
  })

  it('retains customer identity when the ledger request fails', () => {
    mockDefaultQueries()
    mockProfile()
    queries.ledger.mockReturnValue({ isPending: false, isError: true, error: new Error('Private ledger error'), refetch: noop })

    const markup = renderDetail()

    expect(markup).toContain('Ahmed Traders')
    expect(markup).toContain('Main bazaar')
    expect(markup).toContain('Ledger unavailable')
    expect(markup).not.toContain('Private ledger error')
  })

  it('renders server ledger data while the profile is still loading', () => {
    mockDefaultQueries()
    queries.summary.mockReturnValue({ isPending: false, isError: false, data: { summary }, refetch: noop })
    queries.ledger.mockReturnValue({ isPending: false, isError: false, data: { rows: [row], transactions: [] }, refetch: noop })

    const markup = renderDetail()

    expect(markup).toContain('Loading customer profile')
    expect(markup).toContain('PKR 7,500')
    expect(markup).toContain('Received')
  })

  it.each(['loading', 'error'])('keeps daily payment data visible while insights are %s', state => {
    mockDefaultQueries()
    mockProfile()
    queries.daily.mockReturnValue({ isPending: false, isError: false, data: {
      buckets: [{ date: '2026-10-01', amountPkr: 500, transactionCount: 1 }],
    }, refetch: noop })
    if (state === 'error') queries.insights.mockReturnValue({ isPending: false, isError: true, error: new Error('Insights failed'), refetch: noop })

    const markup = renderDetail()

    expect(markup).toContain('role="img"')
    expect(markup).not.toContain('Loading daily payments')
    expect(markup).not.toContain('Daily payments unavailable')
  })

  it('renders the invalid-ID state without account or fabricated profile content', () => {
    mockDefaultQueries()
    const markup = renderDetail('invalid-id')
    expect(markup).toContain('Invalid customer ID')
    expect(markup).not.toContain('Add payment')
    expect(markup).not.toContain('Balance due')
    expect(queries.directory).not.toHaveBeenCalled()
  })

  it('renders the full supplied large ledger with server balances and no local paging', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ ...row, transactionId: `tx-${index}` }))
    const markup = renderToStaticMarkup(<CustomerLedgerTable rows={rows} transactions={[]} filters={{}} today="2026-10-02" isPending={false} isError={false} onFiltersChange={noop} onRetry={noop} />)

    expect(markup).toContain('1000 transactions')
    expect(markup.match(/<tr/g)).toHaveLength(1001)
    expect(markup.match(/PKR 7,500/g)).toHaveLength(1000)
  })

  it('passes the selected business-date range to activity queries independently of all-time summary and ledger filters', () => {
    mockDefaultQueries()
    mockProfile()
    const range = shared.createDateRange('thisMonth')

    renderDetail()

    const dates = { from: range.startDate, to: range.endDate }
    expect(queries.daily).toHaveBeenCalledWith(customerId, dates)
    expect(queries.calendar).toHaveBeenCalledWith(customerId, dates)
    expect(queries.insights).toHaveBeenCalledWith(customerId, { ...dates, referenceDate: expect.any(String) })
    expect(queries.ledger).toHaveBeenCalledWith(customerId, {})
  })
})

vi.mock('../regions/regionalInventory.api', () => ({ useRegions: () => ({ data: [], isPending: false, isError: false }) }))
