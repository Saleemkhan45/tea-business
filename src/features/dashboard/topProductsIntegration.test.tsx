import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ cells: [] as any[], cursor: 0, query: { isPending: false, isError: false, isFetching: false, data: { products: [] }, refetch: vi.fn() }, useTop: vi.fn(), dashboard: vi.fn(), invalidate: vi.fn() }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: vi.fn(), useState: (initial: any) => { const i = h.cursor++; if (!(i in h.cells)) h.cells[i] = typeof initial === 'function' ? initial() : initial; return [h.cells[i], (value: any) => { h.cells[i] = typeof value === 'function' ? value(h.cells[i]) : value }] } }))
vi.mock('../sales/useSales', () => ({ useTopSellingProducts: h.useTop }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: h.invalidate }) }))
vi.mock('./services/dashboard.service', () => ({ useDashboard: h.dashboard }))
import { DashboardPage } from '../../pages/DashboardPage'
import { DateRangeMenu, StatCard } from '../../components/shared'
import { RegionalDashboardSummary } from '../regions/components/RegionalDashboardSummary'
import { DashboardConnectionStatus } from './components/DashboardConnectionStatus'
import { TeaSales } from './components/TeaSales'
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render() { h.cursor = 0; return nodes(DashboardPage()) }
beforeEach(() => { h.cells = []; h.invalidate.mockReset().mockResolvedValue(undefined); h.dashboard.mockReset().mockReturnValue({ data: { metrics: { orders: 0, salesPkr: 0, averageOrderPkr: 0, stockKg: 0, creditSalesPkr: 0 }, daily: [], categories: [], recentSales: [], khata: { outstandingPkr: 0, customers: 0, paymentsTodayPkr: 0, today: '2026-10-18' } }, isPending: false, isError: false }); h.query.refetch.mockReset().mockResolvedValue({ isError: false }); h.useTop.mockReset().mockReturnValue(h.query) })
describe('dashboard top-product integration', () => {
  it('retains KPI -> regional -> revenue/products order and renders each widget only once', () => {
    const tree = render()
    expect(tree.filter(n => n.type === StatCard).map(n => n.props.title)).toEqual(['Total Orders', 'Total Sales', 'Average Order', 'Current Stock'])
    const stats = tree.findIndex(n => n.props.className === 'stats-grid')
    const regional = tree.findIndex(n => n.type === RegionalDashboardSummary)
    const products = tree.findIndex(n => n.type === TeaSales)
    expect(stats).toBeLessThan(regional); expect(regional).toBeLessThan(products)
    expect(tree.filter(n => n.type === TeaSales)).toHaveLength(1)
    expect(tree.find(n => n.type === TeaSales)!.props.query).toBe(h.query)
  })
  it('shares the existing Dashboard Region and date filters with the ranking query', () => {
    let tree = render()
    expect(tree.find(n => n.type === TeaSales)!.props.dateRange.key).toBe('today')
    tree.find(n => n.type === RegionalDashboardSummary)!.props.onRegionChange('507f1f77bcf86cd799439001')
    tree = render()
    expect(h.useTop.mock.lastCall?.[0].regionId).toBe('507f1f77bcf86cd799439001')
    const range = { key: 'custom', startDate: '2026-10-01', endDate: '2026-10-07' }
    tree.find(n => n.type === DateRangeMenu)!.props.onChange(range)
    tree = render()
    expect(h.useTop.mock.lastCall?.[0]).toEqual({ from: range.startDate, to: range.endDate, regionId: '507f1f77bcf86cd799439001' })
    expect(tree.find(n => n.type === TeaSales)!.props.dateRange).toBe(range)
  })
  it('refreshes regional analytics and ranking through their existing query roots', async () => {
    await render().find(n => n.props['aria-label'] === 'Refresh dashboard data')!.props.onClick()
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ['regional', 'dashboard'] }, { throwOnError: true })
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ['sales', 'top-products'] }, { throwOnError: true })
    expect(h.invalidate).toHaveBeenCalledTimes(5)
  })
  it('renders loading and error states with retry and no invented KPI values', () => {
    h.dashboard.mockReturnValue({ data: undefined, isPending: true })
    let tree = render()
    expect(tree.some(n => n.props.label === 'Loading business data...')).toBe(true)
    expect(tree.filter(n => n.type === StatCard).every(n => n.props.value?.props?.className === 'kpi-skeleton')).toBe(true)
    h.dashboard.mockReturnValue({ data: undefined, isPending: false, isError: true })
    tree = render()
    expect(tree.some(n => n.type === DashboardConnectionStatus && n.props.onRetry)).toBe(true)
  })
  it('uses identical scope for all period analytics after changing filters', () => {
    let tree = render()
    tree.find(n => n.type === RegionalDashboardSummary)!.props.onRegionChange('507f1f77bcf86cd799439001')
    tree = render()
    expect(h.dashboard.mock.lastCall?.[0]).toEqual(h.useTop.mock.lastCall?.[0])
  })
  it('keeps the successful products widget available when dashboard totals fail and retries only totals', () => {
    const retry = vi.fn()
    h.dashboard.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Dashboard request rejected (HTTP 400).'), refetch: retry })
    const tree = render()
    expect(tree.filter(n => n.type === TeaSales)).toHaveLength(1)
    expect(tree.find(n => n.type === TeaSales)!.props.query).toBe(h.query)
    const failure = tree.find(n => n.type === DashboardConnectionStatus)!
    expect(failure.props.query.error.message).toContain('HTTP 400')
    failure.props.onRetry()
    expect(retry).toHaveBeenCalledOnce()
    expect(tree.filter(n => n.type === StatCard).every(n => n.props.value === '—')).toBe(true)
  })
})

