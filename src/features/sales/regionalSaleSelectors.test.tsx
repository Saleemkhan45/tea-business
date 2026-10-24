import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RegionalProductSelector, regionalSaleItems, SellingRegionSelector } from './components/RegionalSaleSelectors'
import type { SaleStockItem } from './types/salesApi'

const region = '507f1f77bcf86cd799439020'
const item: SaleStockItem = { id: '507f1f77bcf86cd799439021', regionId: region, name: 'Green Tea', teaType: 'green', availableKg: 2, sellingPrice: 800, lowStockThreshold: 0, updatedAt: null }
type ProductProps = Parameters<typeof RegionalProductSelector>[0]
type RegionProps = Parameters<typeof SellingRegionSelector>[0]
function catalog(items = [item], overrides = {}) {
  return { isPending: false, isError: false, isFetching: false, data: { items }, refetch: vi.fn(), ...overrides } as unknown as ProductProps['catalog']
}
function products(query = catalog(), sellingRegion = region) {
  return renderToStaticMarkup(<RegionalProductSelector region={sellingRegion} value="" onChange={() => {}} catalog={query} />)
}
describe('shared regional sale selectors', () => {
  it('never exposes another region or the unallocated legacy catalog', () => {
    const foreign = { ...item, id: 'foreign', regionId: 'other-region' }
    expect(regionalSaleItems([item, foreign], region)).toEqual([item])
    expect(regionalSaleItems([item], '')).toEqual([])
    expect(regionalSaleItems([item], '', true)).toEqual([item])
  })
  it('requires a region before enabling inventory', () => {
    expect(products(catalog(), '')).toContain('Select a selling region to view its inventory.')
    expect(products(catalog(), '')).toMatch(/aria-label="Sale inventory item[^>]*disabled/)
  })
  it('distinguishes missing assignments, zero stock, loading and API failure', () => {
    expect(products(catalog([]))).toContain('No active regional products are assigned here.')
    expect(products(catalog([{ ...item, availableKg: 0 }]))).toContain('All active products in this region are out of stock.')
    expect(products(catalog([], { isPending: true }))).toContain('Loading regional inventory...')
    expect(products(catalog([], { isError: true }))).toContain('Retry inventory')
    expect(products(catalog([]))).toContain(`/regions?region=${region}`)
  })
  it('maps available products and configured price and blocks programmatic zero-stock selection', () => {
    const changed = vi.fn()
    const tree = RegionalProductSelector({ region, value: '', catalog: catalog([item, { ...item, id: 'zero', availableKg: 0 }]), onChange: changed })
    const select = tree.props.children[1]
    expect(select.props.options[1]).toMatchObject({ value: item.id, disabled: false })
    expect(select.props.options[1].label).toContain('800')
    expect(select.props.options[2].disabled).toBe(true)
    select.props.onChange(item.id)
    expect(changed).toHaveBeenLastCalledWith(item)
    select.props.onChange('zero')
    expect(changed).toHaveBeenLastCalledWith(undefined)
  })
  it('filters inactive regions and provides searchable in-flow selectors and retry states', () => {
    const query = { data: [{ _id: region, name: 'Islamabad', status: 'active' }, { _id: 'inactive', name: 'Inactive', status: 'inactive' }], isPending: false, isError: false, refetch: vi.fn() } as unknown as RegionProps['regions']
    const tree = SellingRegionSelector({ value: '', onChange: () => {}, regions: query })
    const select = tree.props.children[1]
    expect(select.props.options.map((option: { value: string }) => option.value)).toEqual(['', region])
    expect(select.props).toMatchObject({ searchable: true, inline: true })
    expect(renderToStaticMarkup(<SellingRegionSelector value="" onChange={() => {}} regions={{ ...query, isError: true }} />)).toContain('Retry regions')
  })
})
