import { Button, SelectMenu } from '../../../components/shared'
import { ROUTES } from '../../../constants/routes'
import type { useRegions } from '../regionalInventory.api'
import '../../sales/components/regionalSaleSelectors.css'

type Props = {
  value: string; onChange: (value: string) => void
  regions: Pick<ReturnType<typeof useRegions>, 'data' | 'isPending' | 'isError' | 'refetch'>
  floating?: boolean
  label?: string; required?: boolean; includeInactive?: boolean; placeholder?: string; description?: string
}
export function RegionSelector({ value, onChange, regions, label = 'Selling Region', required = true, includeInactive = false, placeholder = 'Select selling region', floating = false, description = 'Choose the fulfillment region independently of the customer address.' }: Props) {
  const active = (regions.data ?? []).filter(region => includeInactive || region.status === 'active')
  return <div className="regional-sale-field">
    <span>{label} {required && <b aria-hidden="true">*</b>}</span>
    <SelectMenu value={value} options={[{ value: '', label: placeholder }, ...active.map(region => ({ value: region._id, label: `${region.name}${region.status === 'inactive' ? ' (inactive)' : ''}` }))]} onChange={onChange} ariaLabel={label.toLowerCase().replace(/^./, letter => letter.toUpperCase())} searchable inline={!floating} floating={floating} disabled={regions.isPending || regions.isError || active.length === 0} />
    {regions.isPending ? <small role="status">Loading regions...</small> : regions.isError ? <div role="alert">Unable to load regions. <Button type="button" onClick={() => void regions.refetch()}>Retry regions</Button></div> : active.length === 0 ? <small role="status">No active selling regions. <a href={ROUTES.regions}>Manage regions</a></small> : null}
    {description && <small>{description}</small>}
  </div>
}
