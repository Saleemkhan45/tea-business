import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CashBookPage } from './CashBookPage'
import { CashPanel } from './CashPanel'
import { CashEntryForm } from './CashEntryForm'
import { CashRecordDetails } from './CashRecordDetails'
import { CashRecordAction } from './CashRecordAction'
import { CashApiError, cashQueryKey, cashCsv, cashErrorMessage, cashRequest, definitiveCashFailure, draftAmounts, refreshConfirmedCash } from './api'
import { day, details, history, overview, ready, today } from './testFixtures'
import { AuthApiError } from '../auth/auth.api'
const auth = vi.hoisted(() => ({ fetch: vi.fn(), role: 'owner' }))
vi.mock('../auth/auth.api', async importOriginal => ({ ...await importOriginal<typeof import('../auth/auth.api')>(), API_BASE_URL: '/api/v1', authenticatedFetch: auth.fetch }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: (selector: (value: object) => unknown) => selector({ session: { user: { role: auth.role, name: 'Offline Owner', shopId: 'shop' } } }) }))
function render(element: React.ReactNode, overrides: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const data = { '/status': ready, '/overview': overview, [`/records/by-date/${today}`]: { date: today, record: day }, '/records?from=2026-10-01&to=2026-10-21&page=1&limit=20': history, [`/records/${day._id}?page=1`]: details, ...overrides }
  for (const [path, value] of Object.entries(data)) client.setQueryData(cashQueryKey('shop', path), value)
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T10:00:00Z')); auth.fetch.mockReset(); auth.role = 'owner' })
afterEach(() => vi.useRealTimers())
describe('manual daily cash page, independent API and reports offline', () => {
  it('lets Save Changes explain missing input instead of silently disabling the button', () => {
    const html = render(<CashEntryForm businessDate={today} record={day} ready initialEditing onSaved={() => {}} />)
    expect(html).toContain('Reason for Correction (required)')
    expect(html).toContain('Explain the correction in 3–500 characters')
    expect(html).toContain('noValidate=""')
    const save = html.match(/<button[^>]*type="submit"[^>]*>Save Changes<\/button>/)?.[0]
    expect(save).toBeTruthy()
    expect(save).not.toContain('disabled')
  })
  it('distinguishes a missing correction route from a missing record', async () => {
    auth.fetch.mockResolvedValueOnce(new Response('{"message":"Route not found."}', { status: 404 }))
    await expect(cashRequest(`/records/${day._id}`, {}, 'PATCH')).rejects.toMatchObject({ status: 404, message: expect.stringContaining('matching backend') })
    auth.fetch.mockResolvedValueOnce(new Response('{"message":"Manual cash record not found."}', { status: 404 }))
    await expect(cashRequest(`/records/${day._id}`, {}, 'PATCH')).rejects.toMatchObject({ status: 404, message: 'Manual cash record not found.' })
  })
  it('loads the saved edit/delete dialog with amounts, reason and no automatic write', () => {
    const edit = render(<CashRecordAction recordId={day._id} action="edit" onClose={() => {}} onSaved={() => {}} />)
    expect(edit).toContain('Edit Daily Cash Record'); expect(edit).toContain('Original Total')
    expect(edit).toContain('Save Changes'); expect(edit).toContain('Reason for Correction')
    expect(edit).toContain(`value="${day.shopCashAmount}"`)
    const remove = render(<CashRecordAction recordId={day._id} action="void" onClose={() => {}} onSaved={() => {}} />)
    expect(remove).toContain('Delete Daily Cash Record?'); expect(remove).toContain('Confirm Delete')
    expect(remove).toContain('Deletion Reason'); expect(remove).toContain('Original amounts and all revisions')
    expect(auth.fetch).not.toHaveBeenCalled()
  })
  it('keeps voided records out of active cards and offers audited replacement and view', () => {
    const voided = { ...day, status: 'voided', revision: 2 }
    const html = render(<CashBookPage />, { [`/records/by-date/${today}`]: { date: today, record: null, voidedRecord: voided } })
    expect(html).toContain('Replace Voided Record'); expect(html).toContain('View Voided Record')
    expect(html).not.toContain('Save Daily Record'); expect(html).toContain('No confirmed saved amount')
    const view = render(<CashRecordDetails recordId={day._id} onClose={() => {}} />, { [`/records/${day._id}?page=1`]: { ...details, record: voided } })
    for (const label of ['Record Status', 'Voided', 'Created At', 'Last Modified At', 'Last Modified By']) expect(view).toContain(label)
  })
  it('updates acknowledged date data and invalidates this shop history, overview and Dashboard queries', async () => {
    const client = new QueryClient(), user = { shopId: 'shop', id: 'owner' }
    const keys = ['/records?from=2026-10-01', '/overview', `/records/by-date/${today}`]
    for (const path of keys) client.setQueryData(cashQueryKey(user.shopId, path, user.id), { record: day })
    const foreign = cashQueryKey('foreign-shop', '/overview', 'other')
    client.setQueryData(foreign, { record: day })
    const voided = { ...day, status: 'voided' as const }
    await refreshConfirmedCash(client, user, voided)
    expect(client.getQueryData(cashQueryKey(user.shopId, `/records/by-date/${today}`, user.id))).toEqual({ date: today, record: null, voidedRecord: voided })
    for (const path of keys) expect(client.getQueryState(cashQueryKey(user.shopId, path, user.id))?.isInvalidated).toBe(true)
    expect(client.getQueryState(foreign)?.isInvalidated).toBe(false)
    client.clear()
  })
  it('rejects voided rows in ordinary history and validates exact detail identities', async () => {
    auth.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...history, rows: [{ ...day, status: 'voided' }] })))
    await expect(cashRequest('/records?from=2026-10-01')).rejects.toMatchObject({ status: 502 })
    auth.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...details, record: { ...day, _id: '507f1f77bcf86cd799439099' } })))
    await expect(cashRequest(`/records/${day._id}?page=1`)).rejects.toMatchObject({ status: 502 })
  })
  it('previews 20000 + 4000 and reads Dashboard amounts for the selected manual date', () => {
    expect(draftAmounts('20000', '4000')).toEqual({ total: 24000 })
    const record = { ...day, businessDate: '2026-10-20', shopCashAmount: 20000, bossAddedAmount: 4000, totalCollected: 24000 }
    const html = render(<CashPanel businessDate="2026-10-20" />, { '/records/by-date/2026-10-20': { date: '2026-10-20', record } })
    expect(html).toContain('PKR 24,000'); expect(html).toContain('2026-10-20')
    expect(html).not.toContain('Today&#x27;s Shop Cash')
  })
  it('shows no fabricated zero KPIs and hides setup instructions from non-owner operators', () => {
    auth.role = 'admin'
    const html = render(<CashBookPage />, { '/status': { ready: false, mode: 'manual_daily', today } })
    expect(html).toContain('No confirmed saved amount')
    expect(html).not.toContain('PKR 0')
    expect(html).not.toContain('Administrator setup steps')
    expect(html).toContain('Contact the shop owner')
  })
  it('rejects wrong-date or malformed read-back instead of showing it as a saved record', async () => {
    auth.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ date: today, record: { ...day, businessDate: '2026-10-20' } })))
    await expect(cashRequest(`/records/by-date/${today}`)).rejects.toMatchObject({ status: 502 })
    auth.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ date: today, record: null })))
    await expect(cashRequest(`/records/by-date/${today}`)).resolves.toEqual({ date: today, record: null })
  })
  it('distinguishes session, authorization, validation, setup, server and connection errors', () => {
    expect(cashErrorMessage(new CashApiError('expired', 401))).toContain('session expired')
    expect(cashErrorMessage(new CashApiError('forbidden', 403))).toContain('permission')
    expect(cashErrorMessage(new CashApiError('Enter valid amounts.', 400))).toBe('Enter valid amounts.')
    expect(cashErrorMessage(new CashApiError('setup', 503, 'MANUAL_CASH_SETUP_REQUIRED'))).toContain('Database setup')
    expect(cashErrorMessage(new CashApiError('server', 500))).toContain('temporarily unavailable')
    expect(cashErrorMessage(new TypeError('offline'))).toContain('connection')
    expect(definitiveCashFailure(new CashApiError('setup', 503, 'MANUAL_CASH_SETUP_REQUIRED'), false)).toBe(true)
    expect(definitiveCashFailure(new CashApiError('setup', 503, 'MANUAL_CASH_SETUP_REQUIRED'), true)).toBe(false)
  })
  it.each([['7000', '3000', 10000], ['7000', '0', 7000], ['0', '3000', 3000], ['0', '0', 0]])('adds %s + %s without subtraction', (shop, boss, total) => {
    expect(draftAmounts(shop, boss)).toEqual({ total })
  })
  it('requires valid whole PKR values and never turns missing inputs into zero', () => {
    expect(draftAmounts('', '')).toEqual({ total: null })
    for (const invalid of ['-1', 'NaN', 'Infinity', '1.5', '1e3', ' ']) expect(draftAmounts(invalid, '0').total).toBeNull()
    expect(draftAmounts(String(Number.MAX_SAFE_INTEGER), '1').total).toBeNull()
  })
  it('renders the requested manual form and saved history without legacy account actions', () => {
    const html = render(<CashBookPage />)
    for (const text of ['Track shop cash, boss contributions and daily collection history.', 'Shop Cash Amount', 'Boss Added Money', 'Total Cash Collected (calculated)', 'Entered By', 'Correct Record', 'Daily Cash History', 'Number of Recorded Days', 'View cash record for', 'Edit cash record for', 'Delete cash record for']) expect(html).toContain(text)
    expect(html).not.toContain('Boss Brings Money'); expect(html).not.toContain('Close Cash Day')
    expect(html).toContain('Yesterday'); expect(html).not.toContain('Money Taken Home'); expect(html).not.toContain('Remaining Cash')
    expect(html).not.toContain('Combined Tracked Cash')
  })
  it('shows no-entry messages rather than fabricated daily zero balances', () => {
    const empty = { today: { date: today, record: null }, yesterday: { date: '2026-10-20', record: null } }
    const html = render(<CashPanel />, { '/overview': empty })
    expect(html).toContain('No cash entry recorded for this date.'); expect(html).toContain('Add Today&#x27;s Entry')
    expect(html).not.toContain('PKR 0')
    const form = render(<CashEntryForm businessDate={today} record={null} ready onSaved={() => {}} />)
    expect(form).toContain('Save Daily Record'); expect(form).not.toContain('value="PKR 0"')
  })
  it('shows actual saved zero records and independently entered Today / Yesterday values', () => {
    const zero = { ...day, shopCashAmount: 0, bossAddedAmount: 0, totalCollected: 0, takenHomeAmount: 0, remainingCash: 0 }
    const html = render(<CashPanel />, { '/overview': { ...overview, today: { date: today, record: zero } } })
    expect(html).toContain('PKR 0'); expect(html).not.toContain('No cash entry recorded')
    expect(html).toContain('Today&#x27;s Total Cash Collected'); expect(html).not.toContain('Remaining Cash')
  })
  it('blocks saving before index readiness and keeps the old feature flag out of the UI', () => {
    const html = render(<CashBookPage />, { '/status': { ready: false, mode: 'manual_daily', today, message: 'Approved manual index setup required.' }, [`/records/by-date/${today}`]: { date: today, record: null } })
    expect(html).toContain('Cash Book saving is not available yet. Database setup is required.'); expect(html).toContain('Save Daily Record')
    expect(html).toContain('Administrator setup steps'); expect(html).not.toContain('Check Setup Again'); expect(html).not.toContain('CASH_BOOK_ENABLED')
    expect(auth.fetch).not.toHaveBeenCalled()
  })
  it('does not grant staff access to manual records, reports or Dashboard amounts', () => {
    auth.role = 'staff'
    expect(render(<CashBookPage />)).toContain('Only an authorized shop owner or admin')
    expect(render(<CashPanel />)).toBe(''); expect(render(<CashPanel report />)).toBe('')
    expect(auth.fetch).not.toHaveBeenCalled()
  })
  it('shows previous/new amounts, authenticated modifier, reason and revision in details', () => {
    const html = render(<CashRecordDetails recordId={day._id} onClose={() => {}} />)
    for (const text of ['role="dialog"', 'aria-modal="true"', 'Previous values', 'Saved values', 'Corrected manually verified home amount', 'Offline Owner', 'PKR 10,000']) expect(html).toContain(text)
  })
  it('summarizes only recorded entries and does not sum daily remaining cash into a current balance', () => {
    const html = render(<CashPanel report />)
    expect(html).toContain('PKR 20,000'); expect(html).toContain('PKR 14,000')
    expect(html).toContain('Average Daily Collection'); expect(html).toContain('Recorded Days')
    expect(html).not.toContain('Taken Home'); expect(html).not.toContain('Remaining Cash')
    expect(html).not.toContain('Total Remaining Cash')
  })
  it('sends only explicit manual command amounts and retains the same command key on retry', async () => {
    auth.fetch.mockImplementation(async () => new Response(JSON.stringify({ record: day, postedRevision: 0 })))
    const body = { key: 'same-key', businessDate: today, shopCashAmount: 7000, bossAddedAmount: 3000, notes: '' }
    await cashRequest('/records', body); await cashRequest('/records', body)
    expect(auth.fetch.mock.calls[0][1].body).toBe(auth.fetch.mock.calls[1][1].body)
    const sent = JSON.parse(auth.fetch.mock.calls[0][1].body)
    expect(sent).not.toHaveProperty('takenHomeAmount'); expect(sent).not.toHaveProperty('totalCollected'); expect(sent).not.toHaveProperty('remainingCash'); expect(sent).not.toHaveProperty('shop'); expect(sent).not.toHaveProperty('enteredBy')
    await cashRequest(`/records/${day._id}`, { key: 'correction', expectedRevision: 0, reason: 'Corrected manual count' }, 'PATCH')
    expect(auth.fetch.mock.calls.at(-1)?.[1].method).toBe('PATCH')
  })
  it('preserves uncertain request keys after later auth/rate-limit failures and distinguishes setup errors', async () => {
    expect(definitiveCashFailure(new AuthApiError('Session changed after dispatch', 401, 'http', true), false)).toBe(false)
    expect(definitiveCashFailure(new CashApiError('Conflict', 409), false)).toBe(true)
    for (const status of [401, 403, 408, 429, 500]) expect(definitiveCashFailure(new CashApiError('Retry', status), true)).toBe(false)
    auth.fetch.mockResolvedValueOnce(new Response('{"message":"Setup required","code":"MANUAL_CASH_SETUP_REQUIRED"}', { status: 503 }))
    await expect(cashRequest('/overview')).rejects.toMatchObject({ status: 503, code: 'MANUAL_CASH_SETUP_REQUIRED' })
  })
  it('rejects invalid success responses and escapes notes without turning numeric CSV values into text formulas', async () => {
    auth.fetch.mockResolvedValueOnce(new Response('<html>Wrong frontend route</html>'))
    await expect(cashRequest('/status')).rejects.toMatchObject({ status: 502 })
    expect(cashCsv([['=SUM(A1)', '  @note', 'quoted "text"', 10000]])).toBe('"\'=SUM(A1)","\'  @note","quoted ""text""","10000"')
  })
})
