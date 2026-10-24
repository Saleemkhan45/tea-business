// Node-only offline fixture generator; never calls the real application API.
import React from 'react'
import { it, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CashBookPage } from './CashBookPage'
import { CashPanel } from './CashPanel'
import { CashRecordDetails } from './CashRecordDetails'
import { cashQueryKey } from './api'
import { ready, today, day, history, overview, details } from './testFixtures'
vi.mock('../auth/auth.api', async importOriginal => ({ ...await importOriginal(), API_BASE_URL: '/api/v1', authenticatedFetch: () => { throw new Error('Network calls are forbidden in offline manual cash fixtures.') } }))
vi.mock('../auth/auth.store', () => ({ useAuthStore: selector => selector({ session: { user: { role: 'owner', name: 'Offline Owner', shopId: 'shop' } } }) }))
it.skipIf(process.env.CASH_BOOK_LAYOUT_FIXTURES !== 'true')('prepares independent manual cash layout fixtures', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
  try {
    function render(element, overrides = {}) {
      const client = new QueryClient()
      const rows = { '/status': ready, '/overview': overview, [`/records/by-date/${today}`]: { date: today, record: day }, '/records?from=2026-10-01&to=2026-10-21&page=1&limit=20': history, [`/records/${day._id}?page=1`]: details, ...overrides }
      for (const [path, value] of Object.entries(rows)) client.setQueryData(cashQueryKey('shop', path), value)
      return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
    }
    const directory = resolve('../.tmp/cashbook-layout'); mkdirSync(directory, { recursive: true })
    const css = ['src/style.css', 'src/audit.css', 'src/theme.css', 'src/features/cashbook/cashbook.css'].map(path => readFileSync(resolve(path), 'utf8').replace(/@import[^;]+;/g, '')).join('\n')
    const longHistory = { ...history, rows: Array.from({ length: 20 }, (_, index) => ({ ...day, _id: `offline-${index}`, notes: 'X'.repeat(500) })) }
    const fixtures = {
      page: render(<CashBookPage />),
      entry: render(<CashBookPage />, { [`/records/by-date/${today}`]: { date: today, record: null } }),
      dashboard: render(<CashPanel />),
      report: render(<CashPanel report />, { '/records?from=2026-10-01&to=2026-10-21&page=1&limit=20': longHistory }),
      details: render(<CashRecordDetails recordId={day._id} onClose={() => {}} />),
      setup: render(<CashBookPage />, { '/status': { ready: false, mode: 'manual_daily', today, message: 'Approved manual history setup required.' } }),
    }
    for (const [name, html] of Object.entries(fixtures)) writeFileSync(resolve(directory, `${name}.html`), `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\nbody{margin:0;padding:16px}</style></head><body>${html}</body></html>`)
  } finally { vi.useRealTimers() }
})
