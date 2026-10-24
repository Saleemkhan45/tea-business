import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
describe('top-product presentation contracts', () => {
  it('keeps existing dashboard columns and confines product styling to the widget', () => {
    const css = readFileSync(new URL('./components/top-selling-products.css', import.meta.url), 'utf8')
    const shared = readFileSync(new URL('../../audit.css', import.meta.url), 'utf8')
    expect(css).toContain('.top-products-panel .ranked-product')
    expect(css).toContain('minmax(0, 1fr) auto')
    expect(css).toContain('overflow-wrap: anywhere')
    expect(css).toContain('@media (max-width: 600px)')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(shared).toContain('.top-grid')
    expect(shared).toContain('@media (max-width: 1080px)')
    expect(shared).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })
  it('removes demo ranking sources from the active widget', () => {
    const source = readFileSync(new URL('./components/TeaSales.tsx', import.meta.url), 'utf8')
    for (const demo of ['scaledQuantity', '843', '397', 'Jasmine Tea', 'Kashmiri Chai', 'dashboardMockData']) expect(source).not.toContain(demo)
    expect(source).toContain('key={product.productId}')
  })
})

describe('dashboard data-source contracts', () => {
  it('has no active mock import or fabricated date scaling', () => {
    const page = readFileSync(new URL('../../pages/DashboardPage.tsx', import.meta.url), 'utf8')
    for (const demo of ['getDashboardMetrics', 'rangeScale', 'dateTransactions', 'dashboardMockData', '8450', 'salesMillions']) expect(page).not.toContain(demo)
    expect(readFileSync(new URL('./services/dashboard.service.ts', import.meta.url), 'utf8')).not.toContain('mockData')
  })
})

