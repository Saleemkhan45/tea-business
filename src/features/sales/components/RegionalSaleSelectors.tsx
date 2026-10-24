import { Button, SelectMenu } from '../../../components/shared'
import { ROUTES } from '../../../constants/routes'
import { formatPKR } from '../../../business/utils/formatters'
import type { useSaleEntryOptions } from '../useSales'
import type { SaleStockItem } from '../types/salesApi'
import './regionalSaleSelectors.css'

type InventoryQuery = Pick<ReturnType<typeof useSaleEntryOptions>, 'data' | 'isPending' | 'isError' | 'isFetching' | 'refetch'>

export { RegionSelector as SellingRegionSelector } from '../../regions/components/RegionSelector'

export function regionalSaleItems(items: SaleStockItem[], region: string, legacy = false) {
  return legacy ? items : region ? items.filter(item => item.regionId === region) : []
}

export function RegionalProductSelector({ region, value, onChange, catalog, legacy = false, error }: {
  region: string
  value: string
  onChange: (item: SaleStockItem | undefined) => void
  catalog: InventoryQuery
  legacy?: boolean
  error?: string
}) {
  const items = regionalSaleItems(catalog.data?.items ?? [], region, legacy)
  const enabled = Boolean(region || legacy)
  const hasStock = items.some(item => item.availableKg > 0)
  return <div className="regional-sale-field">
    <span>Tea / Inventory Product <b aria-hidden="true">*</b></span>
    <SelectMenu key={region} value={value} options={[{ value: '', label: 'Select inventory item' }, ...items.map(item => ({
      value: item.id,
      label: `${item.name} · ${item.teaType} · ${item.availableKg.toLocaleString('en-PK')} kg · ${item.sellingPrice === null ? 'Price not set' : `${formatPKR(item.sellingPrice)}/kg`}${item.availableKg <= 0 ? ' · Out of stock' : ''}`,
      disabled: item.availableKg <= 0,
    }))]} onChange={id => onChange(items.find(item => item.id === id && item.availableKg > 0))} ariaLabel="Sale inventory item" searchable inline disabled={!enabled || catalog.isPending || catalog.isError || items.length === 0} />
    {!enabled ? <small role="status">Select a selling region to view its inventory.</small> : catalog.isPending ? <small role="status">Loading regional inventory...</small> : catalog.isError ? <div role="alert">Unable to load inventory. <Button type="button" onClick={() => void catalog.refetch()}>Retry inventory</Button></div> : <>
      {items.length === 0 ? <small role="status">No active regional products are assigned here. <a href={`${ROUTES.regions}?region=${region}`}>Manage regional inventory</a></small> : !hasStock ? <small role="status">All active products in this region are out of stock. <a href={`${ROUTES.regions}?region=${region}`}>Manage regional inventory</a></small> : null}
      <Button type="button" variant="ghost" disabled={catalog.isFetching} onClick={() => void catalog.refetch()}>Refresh inventory</Button>
    </>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>
}
