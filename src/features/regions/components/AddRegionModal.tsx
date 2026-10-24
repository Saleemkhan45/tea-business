import { useId, useState, type FormEvent } from 'react'
import { Calculator, X } from 'lucide-react'
import { Button, useCloseOnEscape } from '../../../components/shared'
import { REGION_NAMES, REGION_STATUSES } from '../types/regions'
import type { RegionRecord, RegionStatus } from '../types/regions'

type AddRegionModalProps = {
  onClose: () => void
  onSave: (region: RegionRecord) => void
  region?: RegionRecord | null
  existingRegionNames?: string[]
}

type RegionForm = {
  name: string
  city: string
  manager: string
  status: RegionStatus
  sales: string
  todaySales: string
  orders: string
  teaSoldKg: string
  purchaseCost: string
  performance: string
  greenTeaSales: string
  blackTeaSales: string
  currentStock: string
}

const numericFields: Array<keyof RegionForm> = [
  'sales', 'todaySales', 'orders', 'teaSoldKg', 'purchaseCost', 'performance',
  'greenTeaSales', 'blackTeaSales', 'currentStock',
]

function createInitialForm(region?: RegionRecord | null): RegionForm {
  if (!region) {
    return {
      name: '', city: '', manager: '', status: 'Active', sales: '', todaySales: '',
      orders: '', teaSoldKg: '', purchaseCost: '', performance: '', greenTeaSales: '',
      blackTeaSales: '', currentStock: '',
    }
  }

  return {
    name: region.name,
    city: region.city,
    manager: region.manager,
    status: region.status,
    sales: String(region.sales),
    todaySales: String(region.todaySales),
    orders: String(region.orders),
    teaSoldKg: String(region.teaSoldKg),
    purchaseCost: String(region.purchaseCost),
    performance: String(region.performance),
    greenTeaSales: String(region.greenTeaSales),
    blackTeaSales: String(region.blackTeaSales),
    currentStock: String(region.currentStock),
  }
}

const toNumber = (value: string) => Number(value || 0)
const formatCurrency = (value: number) => `PKR ${value.toLocaleString('en-PK')}`

export function AddRegionModal({ onClose, onSave, region, existingRegionNames = [] }: AddRegionModalProps) {
  const [form, setForm] = useState<RegionForm>(() => createInitialForm(region))
  const [error, setError] = useState('')
  const suggestionsId = useId()
  const isEditing = Boolean(region)
  const profit = toNumber(form.sales) - toNumber(form.purchaseCost)

  useCloseOnEscape(onClose)

  function update(field: keyof RegionForm, value: string) {
    setForm(current => ({ ...current, [field]: value }))
    setError('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim() || !form.city.trim() || !form.manager.trim()) {
      setError('Complete the region name, city, and manager before saving.')
      return
    }

    const duplicateName = existingRegionNames.some(name => (
      name.toLowerCase() === form.name.trim().toLowerCase() && name.toLowerCase() !== region?.name.toLowerCase()
    ))
    if (duplicateName) {
      setError('A region with this name already exists.')
      return
    }

    if (numericFields.some(field => !Number.isFinite(toNumber(form[field])) || toNumber(form[field]) < 0)) {
      setError('Performance values must be valid numbers of zero or more.')
      return
    }

    if (toNumber(form.performance) > 100) {
      setError('Performance must be between 0 and 100 percent.')
      return
    }

    onSave({
      id: region?.id ?? `region-${Date.now()}`,
      name: form.name.trim(),
      city: form.city.trim(),
      manager: form.manager.trim(),
      status: form.status,
      sales: toNumber(form.sales),
      todaySales: toNumber(form.todaySales),
      orders: toNumber(form.orders),
      teaSoldKg: toNumber(form.teaSoldKg),
      purchaseCost: toNumber(form.purchaseCost),
      profit,
      performance: toNumber(form.performance),
      greenTeaSales: toNumber(form.greenTeaSales),
      blackTeaSales: toNumber(form.blackTeaSales),
      currentStock: toNumber(form.currentStock),
      recentTransactions: region?.recentTransactions ?? [],
    })
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="sale-modal region-form-modal" role="dialog" aria-modal="true" aria-labelledby="region-form-title">
      <div className="modal-header">
        <div>
          <span className="modal-eyebrow">Regional operations</span>
          <h2 id="region-form-title">{isEditing ? 'Edit Region' : 'Add Region'}</h2>
          <p>{isEditing ? 'Update operational and sales information for this region.' : 'Create a region with its operational and sales baseline.'}</p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label={`Close ${isEditing ? 'edit' : 'add'} region modal`}><X size={19} /></button>
      </div>

      <form onSubmit={submit}>
        <fieldset className="region-form-section">
          <legend>Region details</legend>
          <div className="form-grid">
            <label className="form-field">Region Name
              <input autoFocus list={suggestionsId} value={form.name} placeholder="e.g. Faisalabad" onChange={event => update('name', event.target.value)} />
              <datalist id={suggestionsId}>{REGION_NAMES.map(name => <option value={name} key={name} />)}</datalist>
            </label>
            <label className="form-field">City<input value={form.city} placeholder="e.g. Faisalabad" onChange={event => update('city', event.target.value)} /></label>
            <label className="form-field">Regional Manager<input value={form.manager} placeholder="e.g. Ali Raza" onChange={event => update('manager', event.target.value)} /></label>
            <label className="form-field">Status<select value={form.status} onChange={event => update('status', event.target.value)}>{REGION_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
          </div>
        </fieldset>

        <fieldset className="region-form-section">
          <legend>Commercial performance</legend>
          <div className="form-grid region-metrics-grid">
            <NumberField label="Total Sales" value={form.sales} field="sales" onChange={update} prefix="PKR" />
            <NumberField label="Today's Sales" value={form.todaySales} field="todaySales" onChange={update} prefix="PKR" />
            <NumberField label="Purchase Cost" value={form.purchaseCost} field="purchaseCost" onChange={update} prefix="PKR" />
            <NumberField label="Total Orders" value={form.orders} field="orders" onChange={update} />
            <NumberField label="Tea Sold" value={form.teaSoldKg} field="teaSoldKg" onChange={update} suffix="kg" />
            <NumberField label="Current Stock" value={form.currentStock} field="currentStock" onChange={update} suffix="kg" />
            <NumberField label="Green Tea Sales" value={form.greenTeaSales} field="greenTeaSales" onChange={update} suffix="kg" />
            <NumberField label="Black Tea Sales" value={form.blackTeaSales} field="blackTeaSales" onChange={update} suffix="kg" />
            <NumberField label="Performance" value={form.performance} field="performance" onChange={update} suffix="%" max={100} />
            <div className={`region-profit-preview ${profit < 0 ? 'is-negative' : ''}`} aria-live="polite">
              <span className="region-profit-icon"><Calculator size={16} /></span>
              <span>Calculated profit</span>
              <strong>{formatCurrency(profit)}</strong>
            </div>
          </div>
        </fieldset>

        {error && <p className="form-error-banner" role="alert">{error}</p>}
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{isEditing ? 'Save Changes' : 'Add Region'}</Button>
        </div>
      </form>
    </section>
  </div>
}

function NumberField({ label, value, field, onChange, prefix, suffix, max }: {
  label: string
  value: string
  field: keyof RegionForm
  onChange: (field: keyof RegionForm, value: string) => void
  prefix?: string
  suffix?: string
  max?: number
}) {
  return <label className="form-field">
    {label}
    <span className="number-field-wrap">
      {prefix && <span>{prefix}</span>}
      <input type="number" min="0" max={max} step="1" inputMode="numeric" value={value} placeholder="0" onChange={event => onChange(field, event.target.value)} />
      {suffix && <span>{suffix}</span>}
    </span>
  </label>
}
