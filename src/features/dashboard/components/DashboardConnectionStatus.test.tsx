import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardConnectionStatus } from './DashboardConnectionStatus'
import { useAuthStore } from '../../auth/auth.store'
vi.mock('../../auth/auth.store', async original => {
  const module = await original<typeof import('../../auth/auth.store')>()
  return { ...module, useAuthStore: Object.assign((select: (state: ReturnType<typeof module.useAuthStore.getState>) => unknown) => select(module.useAuthStore.getState()), module.useAuthStore) }
})
const query = { data: { metrics: {} }, isFetching: false, isError: false, error: null, dataUpdatedAt: Date.parse('2026-10-24T04:00:00Z'), failureCount: 0 }
beforeEach(() => useAuthStore.setState({ sessionNeedsValidation: false, sessionCheckPending: false }))
it('keeps verified data labeled as previous during a failed refresh with its actual confirmation time', () => {
  const html = renderToStaticMarkup(<DashboardConnectionStatus query={{ ...query, isError: true, error: new Error('HTTP 503') }} onRetry={() => {}} />)
  expect(html).toContain('Previously loaded data')
  expect(html).toContain('Last confirmed')
  expect(html).toContain('HTTP 503')
  expect(html).toContain('Retry')
  expect(html).not.toContain('loading-spinner')
})
it('shows TailChase only for a genuinely pending request', () => {
  const html = renderToStaticMarkup(<DashboardConnectionStatus query={{ ...query, isFetching: true }} onRetry={() => {}} />)
  expect(html).toContain('Reconnecting to Tea Business server...')
  expect(html).toContain('loading-spinner')
  expect(html).toContain('Previously loaded data')
})
it('never invents amounts or timestamps when no confirmed data exists', () => {
  const html = renderToStaticMarkup(<DashboardConnectionStatus query={{ ...query, data: undefined, isError: true, dataUpdatedAt: 0 }} onRetry={() => {}} />)
  expect(html).toContain('No confirmed dashboard figures')
  expect(html).not.toContain('Last confirmed')
  expect(html).not.toContain('PKR 0')
})
