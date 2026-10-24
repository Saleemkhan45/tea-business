import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { createDateRange, QueryFreshness } from '../../components/shared'
import { TeaSales } from './components/TeaSales'
const refetch = vi.fn()
const products = [{ productId: '507f1f77bcf86cd799439001', name: 'Real Product A', quantityKg: 2 }, { productId: '507f1f77bcf86cd799439002', name: 'Real Product B', quantityKg: .125 }]
const props = (patch: Record<string, unknown> = {}) => ({ dateRange: createDateRange('today'), regionId: '', query: { data: { products, from: '2026-10-16', to: '2026-10-16', regionId: null }, isPending: false, isError: false, isFetching: false, refetch, ...patch } } as unknown as Parameters<typeof TeaSales>[0])
const html = (patch: Record<string, unknown> = {}) => renderToStaticMarkup(<TeaSales {...props(patch)} />)
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
beforeEach(() => refetch.mockReset())
describe('Top Selling Products widget', () => {
  it('displays backend names, all ranks, precise kg, and bars relative to the winner', () => {
    const rendered = html()
    expect(rendered).toContain('Top Selling Products'); expect(rendered).toContain('Most Sold Today')
    expect(rendered).toContain('Real Product A'); expect(rendered).toContain('Real Product B')
    expect(rendered).toContain('0.125 kg'); expect(rendered).toContain('width:100%'); expect(rendered).toContain('width:6.25%')
    expect(rendered).toContain('Rank 1'); expect(rendered).toContain('Rank 2')
    expect(rendered).not.toContain('Jasmine Tea'); expect(rendered).not.toContain('843')
  })
  it('shows skeletons and never fills pending results with demo products', () => {
    const rendered = html({ isPending: true, data: undefined })
    expect(rendered).toContain('Loading top selling products'); expect(rendered).not.toContain('Real Product')
  })
  it('distinguishes initial failure from empty results and labels cached data after refresh failure', () => {
    const initial=html({isError:true,data:undefined})
    expect(initial).toContain('Unable to load top selling products.');expect(initial).not.toContain('Real Product')
    const stale=html({isError:true})
    expect(stale).toContain('may be outdated');expect(stale).toContain('Real Product A');expect(stale).not.toContain('No products sold')
    nodes(TeaSales(props({isError:true}))).find(n=>n.type===QueryFreshness)!.props.onRetry()
    expect(refetch).toHaveBeenCalledOnce()
  })
  it('uses honest empty states for today, selected periods and regions', () => {
    const empty = { products: [], from: '2026-10-16', to: '2026-10-16', regionId: null }
    expect(html({ data: empty })).toContain('No products sold today.')
    expect(renderToStaticMarkup(<TeaSales {...props({ data: empty })} dateRange={createDateRange('last7')} />)).toContain('No products sold during the selected period.')
    expect(renderToStaticMarkup(<TeaSales {...props({ data: empty })} regionId="region" />)).toContain('No sales recorded for this region during the selected period.')
  })
  it('shows exact shared dates and explicitly labels cached readings while refetching', () => {
    const range = createDateRange('custom', '2026-10-01', '2026-10-07')
    const rendered = renderToStaticMarkup(<TeaSales {...props({ isFetching: true })} dateRange={range} />)
    expect(rendered).toContain('2026-10-01 to 2026-10-07'); expect(rendered).toContain('Showing confirmed values')
  })
})
