import { Button } from '../../../components/shared'
import type { RegionalSettingsDraft } from '../openingStockForm'

type Props = {
  draft: RegionalSettingsDraft
  selected: boolean
  catalogPrice?: number | null
  catalogThreshold?: number | null
  disabled?: boolean
  onChange: (draft: RegionalSettingsDraft) => void
}

export function RegionalConfigurationFields({ draft, selected, catalogPrice, catalogThreshold, disabled, onChange }: Props) {
  const inherited = (value: number | null | undefined, unit: string) => !selected
    ? 'No product selected'
    : value == null ? 'Catalog default: Not configured' : `Inherited from catalog: ${value.toLocaleString('en-PK')} ${unit}`
  return <>
    <label>Region Selling Price (PKR/kg)
      <input type="number" min="1" step="1" value={draft.price} disabled={disabled || !selected}
        placeholder={!selected ? 'No product selected' : catalogPrice == null ? 'Not configured' : String(catalogPrice)}
        onChange={event => onChange({ ...draft, price: event.target.value })} />
      <small>{draft.price.trim() ? 'Overridden for this region' : inherited(catalogPrice, 'PKR/kg')}</small>
    </label>
    <label>Region Low Stock Alert (kg)
      <input type="number" min="0" step="0.001" value={draft.threshold} disabled={disabled || !selected}
        placeholder={!selected ? 'No product selected' : catalogThreshold == null ? 'Not configured' : String(catalogThreshold)}
        onChange={event => onChange({ ...draft, threshold: event.target.value })} />
      <small>{draft.threshold.trim() ? 'Overridden for this region' : inherited(catalogThreshold, 'kg')}</small>
    </label>
    <Button type="button" disabled={disabled || !selected || (!draft.price && !draft.threshold)} onClick={() => onChange({ price: '', threshold: '' })}>Reset to Catalog Defaults</Button>
    <small>Blank values inherit the catalog. Reset changes the draft; save to apply it.</small>
  </>
}
