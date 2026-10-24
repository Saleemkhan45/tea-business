import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '../../../components/shared'
import { useUnsavedEntryGuard } from '../../../components/shared/useUnsavedEntryGuard'
import type { CatalogProduct } from '../regionalInventory.api'
import { categoryErrorMessage, saveCatalogProduct, useCatalogProductOptions } from '../catalogProduct.api'
import './catalogProductModal.css'

export type CatalogDraft = {
  name: string; customName: string; teaType: string; sellingPrice: string
  lowStockThreshold: string; status: string; openingQuantityKg: string; receivingRegionId: string
}
export type CatalogProductResult = { product: CatalogProduct; pendingOpeningKg: number }
type Props = {
  onClose: () => void; onSaved: (result: CatalogProductResult) => void
  pendingRegion?: boolean; receivingRegionId?: string
}
export function validateCatalogProduct(form: CatalogDraft, categories: string[], pendingRegion = false, activeRegionIds: string[] = [], confirmed = false) {
  const errors: Partial<Record<keyof CatalogDraft | 'confirmed', string>> = {}
  const custom = form.teaType === 'Other', name = custom ? form.customName : form.name
  if (!name.trim() || name.trim().length > 160) errors[custom ? 'customName' : 'name'] = 'Enter a tea product name of up to 160 characters.'
  if (!categories.includes(form.teaType)) errors.teaType = 'Choose a supported tea category.'
  if ((custom && !form.sellingPrice.trim()) || (form.sellingPrice.trim() && (!Number.isSafeInteger(Number(form.sellingPrice)) || Number(form.sellingPrice) < (custom ? 1 : 0)))) errors.sellingPrice = custom ? 'Enter a positive whole PKR amount.' : 'Enter a non-negative whole PKR amount.'
  if (!form.lowStockThreshold.trim() || !Number.isFinite(Number(form.lowStockThreshold)) || Number(form.lowStockThreshold) < 0) errors.lowStockThreshold = 'Enter a non-negative quantity in kg.'
  if (!['active', 'inactive'].includes(form.status)) errors.status = 'Choose Active or Inactive.'
  if (custom) {
    const kg = Number(form.openingQuantityKg), grams = Math.round(kg * 1000)
    if (!form.openingQuantityKg.trim() || !Number.isFinite(kg) || kg < 0 || !Number.isSafeInteger(grams) || Math.abs(kg - grams / 1000) >= 1e-9) errors.openingQuantityKg = 'Enter non-negative kg with up to three decimals.'
    if (kg > 0) {
      if (form.status !== 'active') errors.status = 'Opening stock requires an active product.'
      if (!pendingRegion && !activeRegionIds.includes(form.receivingRegionId)) errors.receivingRegionId = 'Choose an active stock receiving region.'
      if (!pendingRegion && !confirmed) errors.confirmed = 'Confirm that this is genuine opening stock.'
    }
  }
  return errors
}

export function CatalogProductModal({ onClose, onSaved, pendingRegion = false, receivingRegionId = '' }: Props) {
  const [form, setForm] = useState<CatalogDraft>({ name: '', customName: '', teaType: '', sellingPrice: '', lowStockThreshold: '100', status: 'active', openingQuantityKg: '0', receivingRegionId })
  const [errors, setErrors] = useState<ReturnType<typeof validateCatalogProduct>>({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false), [frozen, setFrozen] = useState(false)
  const request = useRef<{ body: object; pendingOpeningKg: number } | null>(null)
  const uncertain = useRef(false)
  const lock = useRef(false), dialog = useRef<HTMLElement>(null), client = useQueryClient(), id = useId()
  const options = useCatalogProductOptions(pendingRegion)
  const categories = options.categories.data ?? []
  const categoriesReady = !options.categories.isPending && !options.categories.isError && categories.length > 0
  const categoriesEmpty = !options.categories.isPending && !options.categories.isError && categories.length === 0
  const regions = (options.regions.data ?? []).filter(region => region.status === 'active' && (!receivingRegionId || region._id === receivingRegionId))
  const custom = form.teaType === 'Other'
  const initialValues = useRef(form)
  const confirmLeave = useUnsavedEntryGuard(JSON.stringify(form) !== JSON.stringify(initialValues.current), busy, frozen && Boolean(error))
  useEffect(() => {
    if (!form.teaType && categories.length) {
      initialValues.current = { ...initialValues.current, teaType: categories[0] }
      setForm(current => ({ ...current, teaType: categories[0] }))
    }
  }, [categories, form.teaType])
  useEffect(() => {
    const overflow = document.body.style.overflow, previous = document.activeElement
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  useEffect(() => {
    if (!options.categories.isPending) dialog.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus()
  }, [options.categories.isPending])
  useEffect(() => {
    if (custom) dialog.current?.querySelector<HTMLInputElement>('input[name="customName"]')?.focus()
  }, [custom])
  function close() { if (!lock.current && confirmLeave()) onClose() }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    setError('')
    if (!request.current) {
      if (!categoriesReady) {
        setError('Load the supported categories before saving.')
        return
      }
      const next = validateCatalogProduct(form, categories, pendingRegion, regions.map(region => region._id), confirmed)
      setErrors(next)
      if (Object.keys(next).length) {
        dialog.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
        return
      }
      const openingKg = custom ? Number(form.openingQuantityKg) : 0
      request.current = { pendingOpeningKg: pendingRegion ? openingKg : 0, body: {
        name: (custom ? form.customName : form.name).trim(), teaType: form.teaType,
        status: form.status, lowStockThreshold: Number(form.lowStockThreshold),
        ...(form.sellingPrice.trim() ? { sellingPrice: Number(form.sellingPrice) } : {}),
        ...(openingKg > 0 && !pendingRegion ? { openingQuantityKg: openingKg, receivingRegionId: form.receivingRegionId, openingStockConfirmed: confirmed } : {}),
        idempotencyKey: crypto.randomUUID(),
      } }
    }
    lock.current = true; setBusy(true); setFrozen(true)
    let product: CatalogProduct
    try {
      product = await saveCatalogProduct(request.current.body)
    } catch (failure) {
      const status = (failure as { status?: number }).status
      if (!uncertain.current && !(failure as { outcomeUncertain?: boolean }).outcomeUncertain && status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        request.current = null; setFrozen(false)
        setError(status === 409 ? 'This product name already exists or the creation request conflicts. Check the catalog or use another name.' : 'Product creation was rejected. Check your values and receiving region, then try again.')
      } else {
        uncertain.current = true
        setError('Unable to confirm product creation. Retry Same Save uses the original values and key to avoid duplicate stock.')
      }
      lock.current = false; setBusy(false)
      return
    }
    uncertain.current = false
    client.setQueryData<CatalogProduct[]>(['regional', 'products'], current => [ ...(current ?? []).filter(item => item._id !== product._id), product ].sort((a, b) => a.name.localeCompare(b.name)))
    await Promise.allSettled([
      client.invalidateQueries({ queryKey: ['regional'], predicate: query => query.queryKey[1] !== 'product-options' }),
      client.invalidateQueries({ queryKey: ['sales'] }),
    ])
    onSaved({ product, pendingOpeningKg: request.current.pendingOpeningKg })
  }
  function field(key: keyof CatalogDraft) {
    return { id: `${id}-${key}`, name: key, value: form[key], 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined, onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.value })) }
  }
  function message(key: keyof typeof errors) { return errors[key] && <span className="catalog-field-error" id={`${id}-${key}-error`}>{errors[key]}</span> }
  const content = <div className="modal-backdrop catalog-product-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section ref={dialog} className="sale-modal catalog-product-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-busy={busy} onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')
      if (!controls?.length) { event.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className="modal-header"><div><span className="modal-eyebrow">Product catalog</span><h2 id={`${id}-title`}>Add Tea Product</h2></div><button type="button" className="modal-close" aria-label="Close product form" disabled={busy} onClick={close}><X size={19} /></button></header>
      <form noValidate onSubmit={submit}>
        <div className="catalog-product-body">
          {(options.categories.isPending || options.categories.isFetching) && <p role="status">Loading supported categories...</p>}
          {options.categories.isError && !options.categories.isFetching && <p role="alert">{categoryErrorMessage(options.categories.error)} <Button type="button" onClick={() => void options.categories.refetch({ cancelRefetch: false })}>Retry categories</Button></p>}
          {categoriesEmpty && !options.categories.isFetching && <p role="status">No supported categories were returned. Categories are defined by the product schema; ask your administrator to check the backend version. <Button type="button" onClick={() => void options.categories.refetch({ cancelRefetch: false })}>Reload categories</Button></p>}
          <fieldset disabled={busy || frozen}>
            <h3>Product Information</h3>
            <label className="form-field" htmlFor={`${id}-teaType`}>Tea Type / Category<select {...field('teaType')} disabled={!categoriesReady}><option value="" disabled>Choose a category</option>{categories.map(value => <option key={value} value={value}>{value === 'Other' ? '+ Other — Custom Product' : value}</option>)}</select>{message('teaType')}</label>
            {!custom && <label className="form-field" htmlFor={`${id}-name`}>Tea Product Name *<input {...field('name')} required maxLength={160} placeholder="Enter tea product name" />{message('name')}</label>}
            {custom && <div className="catalog-custom-fields">
              <label className="form-field" htmlFor={`${id}-customName`}>Custom Product Name *<input {...field('customName')} required maxLength={160} placeholder="Enter custom tea product name" />{message('customName')}</label>
              <label className="form-field" htmlFor={`${id}-sellingPrice`}>Selling Price (PKR/kg) *<input {...field('sellingPrice')} required type="number" min="1" step="1" />{message('sellingPrice')}</label>
              <label className="form-field" htmlFor={`${id}-openingQuantityKg`}>Opening Stock (kg)<input {...field('openingQuantityKg')} type="number" min="0" step="0.001" />{message('openingQuantityKg')}</label>
              {pendingRegion ? <p className="catalog-product-hint">Opening stock stays in your Add Region draft. It is recorded only when Save Region succeeds; no stock is written by this modal.</p> : <>
                <label className="form-field" htmlFor={`${id}-receivingRegionId`}>Stock Receiving Region {Number(form.openingQuantityKg) > 0 ? '*' : '(for opening stock)'}<select {...field('receivingRegionId')} required={Number(form.openingQuantityKg) > 0} disabled={options.regions.isPending || options.regions.isError}><option value="">Choose an existing region</option>{regions.map(region => <option key={region._id} value={region._id}>{region.name}</option>)}</select>{message('receivingRegionId')}</label>
                {options.regions.isPending && <p role="status">Loading receiving regions...</p>}
                {options.regions.isError && <p role="alert">Unable to load receiving regions. <Button type="button" onClick={() => void options.regions.refetch()}>Retry regions</Button></p>}
                {Number(form.openingQuantityKg) > 0 && <label className="catalog-stock-confirm"><input name="confirmed" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} aria-invalid={Boolean(errors.confirmed)} aria-describedby={errors.confirmed ? `${id}-confirmed-error` : undefined} /><span>I confirm this is genuine opening stock, not stock already recorded elsewhere.{message('confirmed')}</span></label>}
              </>}
            </div>}
            <label className="form-field">Unit<input readOnly value="kg" /></label>
            <h3>Pricing &amp; Stock Settings</h3>
            {!custom && <label className="form-field" htmlFor={`${id}-sellingPrice`}>Default Selling Price (PKR/kg)<input {...field('sellingPrice')} type="number" min="0" step="1" placeholder="Optional default price" />{message('sellingPrice')}</label>}
            <label className="form-field" htmlFor={`${id}-lowStockThreshold`}>Default Low Stock Threshold (kg)<input {...field('lowStockThreshold')} required type="number" min="0" step="0.001" />{message('lowStockThreshold')}</label>
            <label className="form-field" htmlFor={`${id}-status`}>Status<select {...field('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select>{message('status')}</label>
            <p className="catalog-product-hint">Default prices are separate from regional stock and regional price overrides. Zero opening stock creates a catalog definition only.</p>
          </fieldset>{error && <p className="sale-form-error" role="alert">{error}</p>}
        </div>
        <footer className="modal-footer"><Button type="button" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" variant="primary" loading={busy} disabled={busy || (!frozen && !categoriesReady)}>{busy ? 'Saving...' : frozen ? 'Retry Same Save' : pendingRegion ? 'Save & Select Product' : 'Save Product'}</Button></footer>
      </form>
    </section>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
