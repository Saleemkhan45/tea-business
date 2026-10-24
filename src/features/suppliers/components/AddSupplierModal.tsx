import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button, useCloseOnEscape } from '../../../components/shared'
import { useProducts, useRegions } from '../../regions/regionalInventory.api'
import { reconcileSupplier, saveSupplier, supplierRequest, supplierSchema, type LiveSupplier, type SupplierInput } from '../supplier.api'
import { normalizeSupplierOfferings } from '../supplierOfferings'

export function AddSupplierModal({ supplier, onClose, onSave, onViewExisting }: { supplier?: LiveSupplier; onClose: () => void; onSave: () => void; onViewExisting?: (id: string) => void }) {
  const [form, setForm] = useState<SupplierInput>(() => supplier ? { ...supplier, productOfferings: supplier.productOfferings?.length ? supplier.productOfferings : [''] } : { name: '', contactPerson: '', phone: '', alternatePhone: '', email: '', city: '', address: '', notes: '', regions: [], products: [], productOfferings: [''], status: 'active' })
  const [productSearch, setProductSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [reconciliation, setReconciliation] = useState<{ message: string; supplierId?: string }>({ message: '' })
  const [checking, setChecking] = useState(false)
  const regions = useRegions(), products = useProducts()
  const dialog = useRef<HTMLElement>(null), guard = useRef(false)
  const creationKey = useRef<string | undefined>(undefined)
  const save = useMutation({ mutationFn: (input: SupplierInput) => saveSupplier(input, supplier, creationKey.current), retry: false, onSuccess: onSave })
  const saveError = save.error as (Error & { outcomeUncertain?: boolean; existingSupplierId?: string; issues?: { path: string; message: string }[] }) | null
  const close = () => { if (!guard.current) onClose() }
  useCloseOnEscape(close)
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector('input')?.focus()
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  useEffect(() => {
    if (save.isError || formError) {
      const error = dialog.current?.querySelector('[aria-invalid="true"], [role="alert"]')
      error?.scrollIntoView({ block: 'nearest' })
    }
  }, [save.isError, save.error, formError])
  function fieldError(field: string) { return (save.error as (Error & { issues?: { path: string; message: string }[] }) | null)?.issues?.find(issue => issue.path === field)?.message }
  function changeForm(updateForm: (current: SupplierInput) => SupplierInput) {
    if (guard.current || uncertain) return
    save.reset()
    setFormError('')
    setForm(updateForm)
  }
  function update(field: keyof SupplierInput, value: string) { changeForm(current => ({ ...current, [field]: value })) }
  function toggle(field: 'regions' | 'products', id: string) { changeForm(current => ({ ...current, [field]: current[field].includes(id) ? current[field].filter(value => value !== id) : [...current[field], id] })) }
  async function checkSavedSupplier() {
    if (guard.current) return
    guard.current = true; setChecking(true)
    try {
      if (supplier) {
        const data = await supplierRequest(`/${supplier._id}/profile`) as { supplier: unknown }
        const stored = supplierSchema.parse(data.supplier)
        setReconciliation({ message: 'The stored supplier is available. Open it to review the saved details before making further edits.', supplierId: stored._id })
      } else if (creationKey.current) {
        const result = await reconcileSupplier(creationKey.current)
        setReconciliation(result.status === 'confirmed' ? { message: 'A supplier is confirmed in the database for this request. Open the saved record to review it.', supplierId: result.supplier._id } : { message: 'Saving is still unconfirmed. No further write was sent. Check again or request read-only verification.' })
      }
    } catch { setReconciliation({ message: 'The read-only check is unavailable. Saving remains unconfirmed; no further write was sent.' }) }
    finally { guard.current = false; setChecking(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (guard.current || uncertain) return
    const offerings = normalizeSupplierOfferings(form.productOfferings)
    if (!offerings.success) { setFormError(offerings.error.issues[0].message); return }
    setFormError('')
    if (!supplier) creationKey.current ??= crypto.randomUUID()
    guard.current = true
    try { await save.mutateAsync({ ...form, productOfferings: offerings.data }) }
    catch (error) { if (error instanceof Error && 'outcomeUncertain' in error && error.outcomeUncertain) setUncertain(true) }
    finally { guard.current = false }
  }
  const content = <div className="modal-backdrop supplier-edit-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialog} className="sale-modal supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title" aria-busy={save.isPending} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className="modal-header"><div><span className="modal-eyebrow">Supplier network</span><h2 id="supplier-form-title">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2><p>Service areas describe the supplier. Purchase receiving regions are chosen separately.</p></div><button type="button" className="modal-close" aria-label="Close supplier form" disabled={save.isPending} onClick={close}><X size={20} /></button></header>
      <form onSubmit={submit}><div className="supplier-form-body"><fieldset className="supplier-form-fields" disabled={save.isPending || uncertain}>
        <div className="form-grid">{(['name', 'contactPerson', 'phone', 'alternatePhone', 'email', 'city'] as const).map(field => <label className="form-field" key={field}>{({ name: 'Supplier / Company Name *', contactPerson: 'Contact Person', phone: 'Phone Number', alternatePhone: 'Alternate Phone', email: 'Email', city: 'City / Location' })[field]}<input aria-invalid={Boolean(fieldError(field))} aria-describedby={fieldError(field) ? 'supplier-' + field + '-error' : undefined} required={field === 'name'} type={field === 'email' ? 'email' : field.toLowerCase().includes('phone') ? 'tel' : 'text'} maxLength={field === 'email' ? 254 : field.toLowerCase().includes('phone') ? 40 : field === 'city' ? 120 : 160} value={form[field]} onChange={event => update(field, event.target.value)} />{fieldError(field) && <small id={'supplier-' + field + '-error'} role="alert">{fieldError(field)}</small>}</label>)}
          <label className="form-field form-field-wide">Full Address<textarea maxLength={500} rows={2} value={form.address} onChange={event => update('address', event.target.value)} /></label>
          <fieldset className="form-field form-field-wide supplier-options"><legend>Regions served</legend>{regions.isPending ? <p role="status">Loading regions...</p> : regions.isError ? <Button type="button" onClick={() => void regions.refetch()}>Retry regions</Button> : regions.data?.length ? regions.data.map(row => <label key={row._id}><input type="checkbox" checked={form.regions.includes(row._id)} onChange={() => toggle('regions', row._id)} />{row.name}</label>) : <p>No regions configured.</p>}</fieldset>
          <fieldset className="form-field form-field-wide supplier-offerings"><legend>Tea products supplied</legend><p>Describe what this supplier offers. These names do not create catalog products or stock.</p>{form.productOfferings.map((name, index) => <div className="supplier-offering-row" key={index}><label className="form-field">Product Name {index + 1}<input maxLength={160} value={name} onChange={event => changeForm(current => ({ ...current, productOfferings: current.productOfferings.map((value, row) => row === index ? event.target.value : value) }))} /></label><Button type="button" aria-label={`Remove product ${index + 1}`} onClick={() => changeForm(current => ({ ...current, productOfferings: current.productOfferings.filter((_, row) => row !== index) }))}>Remove Product</Button></div>)}<Button type="button" disabled={form.productOfferings.length >= 100} onClick={() => changeForm(current => ({ ...current, productOfferings: [...current.productOfferings, ''] }))}>+ Add Another Product</Button></fieldset>
          <fieldset className="form-field form-field-wide supplier-options"><legend>Catalog-linked products (optional)</legend><input aria-label="Search catalog products" placeholder="Search existing catalog products" value={productSearch} onChange={event => setProductSearch(event.target.value)} />{products.isPending ? <p role="status">Loading catalog...</p> : products.isError ? <Button type="button" onClick={() => void products.refetch()}>Retry products</Button> : products.data?.filter(row => `${row.name} ${row.teaType}`.toLowerCase().includes(productSearch.toLowerCase())).map(row => <label key={row._id}><input type="checkbox" checked={form.products.includes(row._id)} onChange={() => toggle('products', row._id)} />{row.name} / {row.teaType}</label>)}{products.data?.length === 0 && <p>No catalog products configured.</p>}</fieldset>
          <label className="form-field">Supplier Status<select value={form.status} onChange={event => update('status', event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="form-field form-field-wide">Notes<textarea maxLength={2000} rows={3} value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
        </div>{formError && <p className="form-error-banner" role="alert">{formError}</p>}
      </fieldset>{save.isError && <div className="form-error-banner" role="alert"><p>{saveError?.message}</p>{saveError?.existingSupplierId && onViewExisting && <Button onClick={() => onViewExisting(saveError.existingSupplierId!)}>View Existing Supplier</Button>}</div>}{uncertain && <div className="supplier-reconciliation"><p>Further saves are paused until the stored record is reviewed. Your draft is retained.</p><Button loading={checking} disabled={checking} onClick={() => void checkSavedSupplier()}>{checking ? 'Checking...' : 'Check Saved Supplier (read-only)'}</Button>{reconciliation.message && <p role="status">{reconciliation.message}</p>}{reconciliation.supplierId && onViewExisting && <Button onClick={() => onViewExisting(reconciliation.supplierId!)}>View Saved Supplier</Button>}</div>}</div><footer className="modal-footer"><Button type="button" disabled={save.isPending || checking} onClick={close}>Cancel</Button><Button type="submit" variant="primary" loading={save.isPending} disabled={save.isPending || uncertain}>{save.isPending ? 'Saving...' : uncertain ? 'Awaiting confirmation' : supplier ? 'Save Changes' : 'Save Supplier'}</Button></footer></form>
    </section>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}



