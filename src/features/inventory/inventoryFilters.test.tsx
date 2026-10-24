import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const i = state.cursor++; if (!(i in state.values)) state.values[i] = initial; return [state.values[i], (value: unknown) => { state.values[i] = value }] } }))
vi.mock('../regions/regionalInventory.api', async original => ({ ...await original<typeof import('../regions/regionalInventory.api')>(), useRegionalInventory: () => ({ data: [], isPending: false, isError: false }), useRegions: () => ({ data: [{ _id: 'r1', name: 'Islamabad', status: 'active' }, { _id: 'r2', name: 'Inactive', status: 'inactive' }] }) }))
import { InventoryPage } from '../../pages/InventoryPage'
import { RegionSelector } from '../regions/components/RegionSelector'
import { SelectMenu } from '../../components/shared/SelectMenu'
function nodes(node: ReactNode): ReactElement<Record<string, any>>[] { if (Array.isArray(node)) return node.flatMap(nodes); return isValidElement<Record<string, any>>(node) ? [node, ...nodes(node.props.children)] : [] }
function render() { state.cursor = 0; return nodes(InventoryPage()) }
beforeEach(() => { state.values = [] })
describe('inventory filter wiring', () => {
  it('retains filter order, uses a floating active-region selector, and resets all filters', () => {
    let tree = render()
    const bar = tree.find(n => n.props.className === 'sales-filter-bar inventory-filter-bar')!
    expect(bar.props.children).toHaveLength(4)
    let region = tree.find(n => n.type === RegionSelector)!
    expect(region.props.floating).toBe(true)
    const menu = nodes(RegionSelector(region.props as any)).find(n => n.type === SelectMenu)!
    expect(menu.props.options).toEqual([{ value: '', label: 'All Regions' }, { value: 'r1', label: 'Islamabad' }])
    region.props.onChange('r1')
    tree.find(n => n.props['aria-label'] === 'Search inventory')!.props.onChange({ target: { value: 'Green' } })
    tree.find(n => n.props['aria-label'] === 'Filter inventory by availability')!.props.onChange({ target: { value: 'available' } })
    tree = render()
    expect(tree.find(n => n.type === RegionSelector)!.props.value).toBe('r1')
    tree.find(n => n.props.children === 'Reset filters')!.props.onClick()
    tree = render()
    expect(tree.find(n => n.type === RegionSelector)!.props.value).toBe('')
    expect(tree.find(n => n.props['aria-label'] === 'Search inventory')!.props.value).toBe('')
    expect(tree.find(n => n.props['aria-label'] === 'Filter inventory by availability')!.props.value).toBe('')
  })
})
