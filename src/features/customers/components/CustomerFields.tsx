import type { RefObject } from 'react'
import type { CustomerDraft, CustomerDraftErrors } from '../customerForm'
import { SelectMenu } from '../../../components/shared'
import '../../sales/components/regionalSaleSelectors.css'

type Props = {
  draft: CustomerDraft
  errors?: CustomerDraftErrors
  idPrefix: string
  disabled?: boolean
  nameInputRef?: RefObject<HTMLInputElement | null>
  onChange: (field: keyof CustomerDraft, value: string) => void
  regionOptions?: Array<{ _id: string; name: string; status: string }>
}

export function CustomerFields({ draft, errors = {}, idPrefix, disabled, nameInputRef, onChange, regionOptions = [] }: Props) {
  const activeRegions = regionOptions.filter(region => region.status === 'active')
  return <>
    <label htmlFor={`${idPrefix}-name`}>Customer Name <span aria-hidden="true">*</span>
      <input ref={nameInputRef} id={`${idPrefix}-name`} name="name" autoComplete="name" required maxLength={160} disabled={disabled} value={draft.name} onChange={event => onChange('name', event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined} />
      {errors.name && <small id={`${idPrefix}-name-error`} className="field-error" role="alert">{errors.name}</small>}
    </label>
    <label htmlFor={`${idPrefix}-phone`}>Phone Number <small>(optional)</small>
      <input id={`${idPrefix}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} disabled={disabled} value={draft.phone} onChange={event => onChange('phone', event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined} />
      {errors.phone && <small id={`${idPrefix}-phone-error`} className="field-error" role="alert">{errors.phone}</small>}
    </label>
    <label htmlFor={`${idPrefix}-city`}>Location / City <small>(optional)</small>
      <input id={`${idPrefix}-city`} name="city" autoComplete="address-level2" maxLength={120} disabled={disabled} value={draft.city} onChange={event => onChange('city', event.target.value)} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? `${idPrefix}-city-error` : undefined} />
      {errors.city && <small id={`${idPrefix}-city-error`} className="field-error" role="alert">{errors.city}</small>}
    </label>
    {activeRegions.length > 0 ? <div className="regional-sale-field"><span>Customer Region <small>(optional)</small></span><SelectMenu value={draft.region} options={[{ value: '', label: 'No assigned customer region' }, ...activeRegions.map(region => ({ value: region.name, label: region.name })), ...(draft.region && !activeRegions.some(region => region.name === draft.region) ? [{ value: draft.region, label: `${draft.region} (existing)` }] : [])]} onChange={value => onChange('region', value)} ariaLabel="Customer assigned region" searchable inline disabled={disabled} /><small>This describes the customer and does not select the sale stock source.</small>{errors.region && <small id={`${idPrefix}-region-error`} className="field-error" role="alert">{errors.region}</small>}</div> : <label htmlFor={`${idPrefix}-region`}>Customer Region <small>(optional)</small>
      <input id={`${idPrefix}-region`} list={`${idPrefix}-region-options`} name="region" autoComplete="address-level1" maxLength={120} disabled={disabled} value={draft.region} onChange={event => onChange('region', event.target.value)} aria-invalid={Boolean(errors.region)} aria-describedby={errors.region ? `${idPrefix}-region-error` : undefined} />
      <datalist id={`${idPrefix}-region-options`}>{regionOptions.filter(region => region.status === 'active').map(region => <option key={region._id} value={region.name} />)}</datalist>
      {errors.region && <small id={`${idPrefix}-region-error`} className="field-error" role="alert">{errors.region}</small>}
    </label>}
    <label className="customer-wide-field" htmlFor={`${idPrefix}-address`}>Address <small>(optional)</small>
      <textarea id={`${idPrefix}-address`} name="address" autoComplete="street-address" rows={3} maxLength={300} disabled={disabled} value={draft.address} onChange={event => onChange('address', event.target.value)} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? `${idPrefix}-address-error` : undefined} />
      {errors.address && <small id={`${idPrefix}-address-error`} className="field-error" role="alert">{errors.address}</small>}
    </label>
    <label className="customer-wide-field" htmlFor={`${idPrefix}-notes`}>Notes <small>(optional)</small>
      <textarea id={`${idPrefix}-notes`} name="notes" rows={3} maxLength={1000} disabled={disabled} value={draft.notes} onChange={event => onChange('notes', event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? `${idPrefix}-notes-error` : undefined} />
      {errors.notes && <small id={`${idPrefix}-notes-error`} className="field-error" role="alert">{errors.notes}</small>}
    </label>
  </>
}
