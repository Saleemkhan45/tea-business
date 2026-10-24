import { useQuery, type QueryClient } from '@tanstack/react-query'
import { API_BASE_URL, AuthApiError, authenticatedFetch } from '../auth/auth.api'
import { useAuthStore } from '../auth/auth.store'
import { getPakistanBusinessDate } from '../../business/utils/date'

export type CashValues = { shopCashAmount: number; bossAddedAmount: number; totalCollected: number; takenHomeAmount?: number; remainingCash?: number; notes: string }
export type CashOperator = { _id: string; name: string }
export type CashDay = CashValues & { _id: string; businessDate: string; revision: number; enteredBy: CashOperator | null; lastUpdatedBy: CashOperator | null; createdAt: string; updatedAt: string; status?: 'active' | 'voided'; voidedBy?: CashOperator | null; voidedAt?: string | null; voidReason?: string }
export type DayResult = { date: string; record: CashDay | null; voidedRecord?: CashDay | null }
export type CashOverview = { today: DayResult; yesterday: DayResult }
export type CashStatus = { ready: boolean; mode: 'manual_daily'; today: string; message?: string; setup?: { collection?: string; reason: 'collection_missing' | 'indexes_incompatible'; missingIndexes?: Record<string, number>[]; conflictingIndexes?: number } }
export type CashSummary = { shopCashAmount: number; bossAddedAmount: number; totalCollected: number; recordedDays: number; averageDailyCollection: number | null }
export type CashHistory = { rows: CashDay[]; summary: CashSummary; from: string; to: string; total: number; page: number; limit: number }
export type CashAudit = { _id: string; revision: number; action: 'create' | 'correct' | 'void' | 'replace'; previous: (CashValues & { status?: string }) | null; next: CashValues & { status?: string }; reason: string; modifiedBy: CashOperator | null; createdAt: string }
export type CashDetails = { record: CashDay; audit: CashAudit[]; total: number; page: number; limit: number }
export class CashApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}
export function definitiveCashFailure(error: unknown, previouslyUncertain: boolean) {
  if (error instanceof AuthApiError && error.outcomeUncertain) return false
  return !previouslyUncertain && ((error instanceof CashApiError && (error.code === 'MANUAL_CASH_SETUP_REQUIRED' || (error.status >= 400 && error.status < 500 && error.status !== 408))) || (error instanceof AuthApiError && (error.status === 401 || error.kind === 'authorization')))
}
export async function cashRequest<T>(path: string, body?: object, method = body ? 'POST' : 'GET', signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/cashbook${path}`, { method, ...(signal ? { signal } : {}), headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const payload = await response.json().catch(() => null)
  if (!response.ok && method === 'PATCH' && response.status === 404 && payload?.message === 'Route not found.') throw new CashApiError('The running backend does not support Cash Book corrections. Restart or deploy the matching backend version, then retry.', 404)
  if (!response.ok) throw new CashApiError(payload?.issues?.[0]?.message ?? payload?.message ?? 'Manual Cash Book request failed. Retry.', response.status, payload?.code)
  if (!payload || typeof payload !== 'object') throw new CashApiError('The backend returned an invalid manual Cash Book response. Refresh and check the deployed version.', 502)
  if (path.startsWith('/records/by-date/')) {
    const expected = path.slice('/records/by-date/'.length)
    if (payload.date !== expected || (payload.record !== null && (!confirmedCashDay(payload.record) || payload.record.businessDate !== expected || payload.record.status === 'voided')) || (payload.voidedRecord && (!confirmedCashDay(payload.voidedRecord) || payload.voidedRecord.status !== 'voided' || payload.voidedRecord.businessDate !== expected || payload.record !== null))) throw new CashApiError('The backend returned an unconfirmed or mismatched cash record. Refresh and retry.', 502)
  }
  if (path.startsWith('/records?') && (!Array.isArray(payload.rows) || !payload.rows.every((row: CashDay) => confirmedCashDay(row) && row.status !== 'voided') || !payload.summary || ![payload.summary.shopCashAmount, payload.summary.bossAddedAmount, payload.summary.totalCollected, payload.summary.recordedDays, payload.total].every(value => Number.isSafeInteger(value) && value >= 0) || payload.summary.totalCollected !== payload.summary.shopCashAmount + payload.summary.bossAddedAmount || payload.total !== payload.summary.recordedDays)) throw new CashApiError('The backend returned unconfirmed cash history. Retry before exporting or making another change.', 502)
  if (/^\/records\/[a-f\d]{24}\?page=/.test(path) && (!confirmedCashDay(payload.record) || payload.record._id !== path.split('/')[2].split('?')[0] || !Array.isArray(payload.audit))) throw new CashApiError('The backend returned unconfirmed cash details. Retry.', 502)
  return payload as T
}
export function useCashAccess() { return useAuthStore(state => ['owner', 'admin'].includes(state.session?.user.role ?? '')) }
export function cashQueryKey(shop: string | undefined, path: string, userId?: string) {
  return ['manual-cashbook', shop, path, { userId: userId ?? null, today: getPakistanBusinessDate() }] as const
}
export function confirmedCashDay(value: CashDay | undefined): value is CashDay {
  return Boolean(value && /^[a-f\d]{24}$/i.test(value._id) && /^\d{4}-\d{2}-\d{2}$/.test(value.businessDate)
    && (value.status === undefined || value.status === 'active' || value.status === 'voided')
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && [value.shopCashAmount, value.bossAddedAmount, value.totalCollected].every(amount => Number.isSafeInteger(amount) && amount >= 0)
    && value.totalCollected === value.shopCashAmount + value.bossAddedAmount)
}
export async function refreshConfirmedCash(client: QueryClient, user: { shopId?: string; id?: string } | undefined, record: CashDay) {
  const prefix = ['manual-cashbook', user?.shopId]
  await Promise.allSettled([client.cancelQueries({ queryKey: prefix })])
  client.setQueryData(cashQueryKey(user?.shopId, `/records/by-date/${record.businessDate}`, user?.id), record.status === 'voided' ? { date: record.businessDate, record: null, voidedRecord: record } : { date: record.businessDate, record })
  const refresh = await Promise.allSettled([client.invalidateQueries({ queryKey: prefix }, { throwOnError: true })])
  return refresh.some(result => result.status === 'rejected') ? ' Refresh failed; reload saved history before making another change.' : ''
}
export function useCashQuery<T>(path: string, enabled = true, refetchInterval: number | false = false) {
  const access = useCashAccess(), user = useAuthStore(state => state.session?.user)
  return useQuery({ queryKey: cashQueryKey(user?.shopId, path, user?.id), queryFn: ({ signal }) => cashRequest<T>(path, undefined, 'GET', signal), enabled: access && enabled, retry: false, staleTime: 15000, refetchOnWindowFocus: false, refetchInterval })
}
export function draftAmounts(shop: string, boss: string) {
  const valid = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value))
  const total = valid(shop) && valid(boss) && Number.isSafeInteger(Number(shop) + Number(boss)) ? Number(shop) + Number(boss) : null
  return { total }
}
export function cashErrorMessage(error: unknown) {
  if (error instanceof CashApiError || error instanceof AuthApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again before retrying.'
    if (error.status === 403) return 'You do not have permission to save this entry. Refresh your session or contact the shop owner.'
    if (error.status === 408) return 'The Cash Book request timed out. Retry the same request; its outcome may be unknown.'
    if (error instanceof CashApiError && error.code === 'MANUAL_CASH_SETUP_REQUIRED') return 'Cash Book saving is not available yet. Database setup is required.'
    if (error instanceof CashApiError && error.code === 'MANUAL_CASH_PERMISSION_REQUIRED') return 'Cash Book database access requires administrator review. Your entry has not been cleared.'
    if (error.status === 429) return error.message
    if (error.status >= 500) return 'Cash Book is temporarily unavailable. Please retry shortly.'
    return error.message
  }
  return 'Could not reach Cash Book. Check your connection and retry.'
}
export function cashCsv(rows: unknown[][]) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '')
    const safe = typeof value === 'string' ? text.replace(/^\s*[=+\-@]|^[\t\r\n]/, "'$&") : text
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}
export function downloadCashCsv(rows: unknown[][], filename: string) {
  const url = URL.createObjectURL(new Blob([cashCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}
