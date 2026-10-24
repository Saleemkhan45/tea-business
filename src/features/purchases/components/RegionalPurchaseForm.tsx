import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { getPakistanBusinessDate } from '../../../business/utils/date'
import { useAuthStore } from '../../auth/auth.store'
import { RegionSelector } from '../../regions/components/RegionSelector'
import { useRegions, useRegionalInventory } from '../../regions/regionalInventory.api'
import { purchaseRequest, useInvalidatePurchases, usePurchaseOptions, writePurchase } from '../purchase.api'
import { purchaseFormSchema, purchasePreview } from '../purchaseForm'
import type { PurchaseWriteInput } from '../types/purchaseApi'
import { useUnsavedEntryGuard } from '../../../components/shared/useUnsavedEntryGuard'

export function RegionalPurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ supplier: '', item: '', receivingRegion: '', businessDate: getPakistanBusinessDate(), quantity: '', unitCost: '', tax: '0', shipping: '0', discount: '0', amountPaid: '0', method: 'cash' as 'cash' | 'bank_transfer' | 'cheque', status: 'received' as PurchaseWriteInput['status'], reference: '', notes: '' })
  const [error, setError] = useState('')
  const [review, setReview] = useState<PurchaseWriteInput | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const frozen = useRef<PurchaseWriteInput | null>(null)
  const guard = useRef(false)
  const dialog = useRef<HTMLElement>(null)
  const regions = useRegions(), stock = useRegionalInventory(form.receivingRegion), suppliers = usePurchaseOptions()
  const operator = useAuthStore(state => state.session?.user.name)
  const invalidate = useInvalidatePurchases()
  const save = useMutation({ mutationFn: (request: PurchaseWriteInput) => writePurchase('', request), retry: false, onSuccess: async () => { await invalidate(); onSaved() } })
  const initialValues = useRef(form)
  const confirmLeave = useUnsavedEntryGuard(JSON.stringify(form) !== JSON.stringify(initialValues.current) || Boolean(supplierName), save.isPending, save.isError && Boolean(frozen.current))
  const addSupplier = useMutation({ mutationFn: () => purchaseRequest('/suppliers', { name: supplierName }), retry: false, onSuccess: async () => { setSupplierName(''); await suppliers.refetch() } })
  const close = () => { if (!save.isPending && !dialog.current?.querySelector('.select-menu.is-open') && confirmLeave()) onClose() }
  useCloseOnEscape(close)
  useEffect(() => {
    const overflow = document.body.style.overflow, focus = document.activeElement
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector('input')?.focus()
    return () => { document.body.style.overflow = overflow; if (focus instanceof HTMLElement) focus.focus() }
  }, [])
  const request = { supplier: form.supplier, item: form.item, receivingRegion: form.receivingRegion, businessDate: form.businessDate, quantityKg: Number(form.quantity), unitCost: Number(form.unitCost), taxAmount: Number(form.tax), shippingAmount: Number(form.shipping), discountAmount: Number(form.discount), status: form.status, reference: form.reference, notes: form.notes }
  const total = purchasePreview(request)
  function update(field: keyof typeof form, value: string) { setForm(current => ({ ...current, [field]: value })); setError('') }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (guard.current || save.isPending) return
    if (!review && !frozen.current) {
      const result = purchaseFormSchema.safeParse(request)
      const paid = Number(form.amountPaid)
      if (!result.success || !form.quantity.trim() || !form.unitCost.trim() || total === undefined || !Number.isSafeInteger(paid) || paid < 0 || paid > total) {
        setError('Choose a supplier, receiving region and assigned product. Use a valid date, positive kg (up to 3 decimals), whole PKR costs and payment no greater than the total.'); return
      }
      const key = crypto.randomUUID()
      setReview({ ...result.data, idempotencyKey: key, ...(paid ? { payment: { amountPkr: paid, method: form.method, businessDate: form.businessDate, idempotencyKey: `${key}:payment` } } : {}) })
      return
    }
    frozen.current ??= review
    if (!frozen.current) return
    guard.current = true
    try { await save.mutateAsync(frozen.current) } catch { /* The same request remains available for retry. */ } finally { guard.current = false }
  }
  const items = (stock.data ?? []).filter(row => row.regionId === form.receivingRegion && row.status !== 'inactive')
  return <div className="customer-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialog} className="customer-modal customer-add-modal" role="dialog" aria-modal="true" aria-labelledby="regional-purchase-title" aria-busy={save.isPending} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className="customer-modal-header"><div><span>Regional purchasing</span><h2 id="regional-purchase-title">Add Purchase</h2></div><button type="button" aria-label="Close purchase form" onClick={close} disabled={save.isPending}><X size={18} /></button></header>
      <form onSubmit={submit} noValidate>
        <fieldset className="regional-form regional-purchase-fields" disabled={save.isPending || Boolean(review)}>
          <div className="regional-sale-field"><span>Supplier *</span><SelectMenu value={form.supplier} options={[{ value: '', label: 'Select supplier' }, ...(suppliers.data ?? []).map(row => ({ value: row._id, label: row.name }))]} onChange={value => update('supplier', value)} ariaLabel="Purchase supplier" searchable inline />{suppliers.isPending && <small role="status">Loading suppliers...</small>}{suppliers.isError && <Button type="button" onClick={() => void suppliers.refetch()}>Retry suppliers</Button>}{suppliers.data?.length === 0 && <small>No active suppliers. Add a supplier below.</small>}</div>
          <div className="regional-supplier-create"><label>New supplier name<input maxLength={160} value={supplierName} onChange={event => setSupplierName(event.target.value)} /></label><Button type="button" disabled={!supplierName.trim() || addSupplier.isPending} onClick={() => addSupplier.mutate()}>Add supplier</Button>{addSupplier.isError && <small role="alert">{addSupplier.error.message}</small>}</div>
          <label>Purchase Date *<input type="date" value={form.businessDate} onChange={event => update('businessDate', event.target.value)} /></label>
          <RegionSelector label="Receiving Region" placeholder="Select receiving region" description="Stock increases here only after confirmed receipt." value={form.receivingRegion} regions={regions} onChange={value => setForm(current => ({ ...current, receivingRegion: value, item: '' }))} />
          <div className="regional-sale-field"><span>Tea Product *</span><SelectMenu value={form.item} options={[{ value: '', label: 'Select assigned product' }, ...items.map(row => ({ value: row.itemId, label: `${row.name} · ${row.teaType} · ${row.availableKg} kg currently available` }))]} onChange={value => update('item', value)} ariaLabel="Receiving product" searchable inline disabled={!form.receivingRegion || stock.isPending || stock.isError} />{stock.isError && <Button type="button" onClick={() => void stock.refetch()}>Retry products</Button>}{form.receivingRegion && !stock.isPending && items.length === 0 && <a href={`/regions?region=${form.receivingRegion}`}>Assign a catalog product to this region</a>}</div>
          <label>Purchased Quantity (kg) *<input type="number" min="0.001" step="0.001" value={form.quantity} onChange={event => update('quantity', event.target.value)} /></label>
          <label>Purchase Unit Cost (PKR) *<input type="number" min="0" step="1" value={form.unitCost} onChange={event => update('unitCost', event.target.value)} /></label>
          {(['tax', 'shipping', 'discount'] as const).map(field => <label key={field}>{field === 'tax' ? 'Tax' : field === 'shipping' ? 'Shipping' : 'Discount'} (PKR)<input type="number" min="0" step="1" value={form[field]} onChange={event => update(field, event.target.value)} /></label>)}
          <label>Receipt Status<select value={form.status} onChange={event => update('status', event.target.value)}><option value="received">Received — increase regional stock</option><option value="pending">Pending — no stock increase</option><option value="in_transit">In transit — no stock increase</option></select></label>
          <label>Supplier Payment (PKR)<input type="number" min="0" step="1" value={form.amountPaid} onChange={event => update('amountPaid', event.target.value)} /></label>
          <label>Payment Method<select value={form.method} onChange={event => update('method', event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option></select></label>
          <label>Invoice / Reference<input maxLength={160} value={form.reference} onChange={event => update('reference', event.target.value)} /></label>
          <label>Notes<textarea rows={3} maxLength={1000} value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
          <label>Entered By<input readOnly value={operator ?? 'Authenticated operator'} /></label>
        </fieldset>
        <div className="regional-purchase-review" aria-live="polite"><strong>Total Purchase Amount: {total === undefined ? 'Review quantity and cost' : formatPKR(total)}</strong>{review && <p>{review.status === 'received' ? `${review.quantityKg} kg will be added only to the selected receiving region.` : 'No stock changes until this purchase is received.'} Confirm the supplier, region and payment before recording.</p>}{error && <p role="alert">{error}</p>}{save.isError && <p role="alert">{save.error.message} Retry retains the original values and operation key.</p>}</div>
        <footer className="customer-modal-footer"><Button type="button" onClick={close} disabled={save.isPending}>Cancel</Button>{review && !frozen.current && <Button type="button" onClick={() => setReview(null)}>Back to edit</Button>}<Button type="submit" variant="primary" loading={save.isPending} disabled={save.isPending}>{save.isPending ? 'Recording...' : save.isError ? 'Retry same purchase' : review ? 'Confirm Purchase' : 'Review Purchase'}</Button></footer>
      </form>
    </section>
  </div>
}
