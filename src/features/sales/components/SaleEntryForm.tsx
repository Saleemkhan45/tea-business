import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RotateCcw, Save, X } from 'lucide-react'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import { clearSaleStockSelection, initialSaleForm, validateSaleForm } from '../saleForm'
import type { SaleFormErrors, SaleFormValues } from '../saleForm'
import { getSalesErrorMessage, SalesApiError } from '../services/sales.service'
import type { SaleDto, SalePaymentMethod, SaleWriteInput } from '../types/salesApi'
import { CustomerSelector } from './CustomerSelector'
import { useRegions } from '../../regions/regionalInventory.api'
import { useSaleEntryOptions } from '../useSales'
import type { SaleDraft } from '../saleCustomerNavigation'
import { useCustomerById, useCustomerLedgerSummary } from '../../customer-ledger'
import { formatPKR } from '../../../business/utils/formatters'
import { calculateCustomerPurchaseAmountPkr } from '../../../business/domain/customer-ledger.types'
import { useAuthStore } from '../../auth/auth.store'
import { SellingRegionSelector, RegionalProductSelector } from './RegionalSaleSelectors'
import { useUnsavedEntryGuard } from '../../../components/shared/useUnsavedEntryGuard'

type Props = {
  sale?: SaleDto
  onClose: () => void
  onSubmit: (input: SaleWriteInput) => Promise<void>
  submitting: boolean
  locked?: boolean
  error: Error | null
  onReset?: () => void
  initialCustomerId?: string
  initialDraft?: SaleDraft
  onAddNewCustomer?: (draft: SaleDraft) => void
}

const paymentOptions: Array<{ value: SalePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Khata / Credit' },
  { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' },
]
const statusOptions: Array<{ value: SaleFormValues['status']; label: string }> = [
  { value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' },
]

export function SaleEntryForm({ sale, onClose, onSubmit, submitting, locked = false, error, onReset, initialCustomerId, initialDraft, onAddNewCustomer }: Props) {
  const [form, setForm] = useState(() => ({ ...initialSaleForm(sale), ...(!sale ? initialDraft?.form : {}), customerId: sale?.customer ?? initialCustomerId ?? initialDraft?.form.customerId ?? '' }))
  const [errors, setErrors] = useState<SaleFormErrors>({})
  const [sellingRegion, setSellingRegion] = useState(sale?.sellingRegion ?? initialDraft?.sellingRegion ?? '')
  const initialValues = useRef(initialSaleForm(sale))
  const confirmLeave = useUnsavedEntryGuard(JSON.stringify(form) !== JSON.stringify(initialValues.current) || sellingRegion !== (sale?.sellingRegion ?? ''), submitting, locked && Boolean(error))
  const regions = useRegions()
  const legacyEdit = Boolean(sale && !sale.sellingRegion)
  const catalog = useSaleEntryOptions(sellingRegion || undefined, Boolean(sellingRegion) || legacyEdit)
  const operator = useAuthStore(state => state.session?.user)
  const summary = useCustomerLedgerSummary(form.customerId || undefined)
  const restoredCustomer = useCustomerById(initialDraft ? form.customerId || undefined : undefined)
  const [draftRevalidated, setDraftRevalidated] = useState(!initialDraft)
  useEffect(() => {
    if (!initialDraft) return
    let active = true
    const refreshes: Promise<unknown>[] = [regions.refetch({ cancelRefetch: false })]
    if (initialDraft.sellingRegion) refreshes.push(catalog.refetch({ cancelRefetch: false }))
    if (initialDraft.form.customerId) refreshes.push(summary.refetch({ cancelRefetch: false }), restoredCustomer.refetch({ cancelRefetch: false }))
    void Promise.allSettled(refreshes).then(() => { if (active) setDraftRevalidated(true) })
    return () => { active = false }
  }, [initialDraft, regions.refetch, catalog.refetch, summary.refetch, restoredCustomer.refetch])
  const restoring = Boolean(initialDraft) && (!draftRevalidated || regions.isFetching || catalog.isFetching || summary.isFetching || restoredCustomer.isFetching)
  const restoredAccountReady = !initialDraft || Boolean(form.customerId && restoredCustomer.data?.customer.status === 'active' && !restoredCustomer.isError && !summary.isPending && !summary.isError)
  const restoredRegionReady = !initialDraft || regions.data?.some(region => region._id === sellingRegion && region.status === 'active')
  const dialogRef = useRef<HTMLElement>(null)
  const submitGuard = useRef(false)
  const editing = Boolean(sale)
  const titleId = editing ? 'edit-sale-title' : 'add-sale-title'
  let preview: number | undefined
  if (form.quantity.trim() && form.unitPrice.trim()) {
    try { preview = calculateCustomerPurchaseAmountPkr(Number(form.quantity), Number(form.unitPrice)) } catch { preview = undefined }
  }
  const stockItem = (sellingRegion || legacyEdit) ? catalog.data?.items.find(item => item.id === form.stockLocationId && (legacyEdit || item.regionId === sellingRegion)) : undefined
  const availableKg = stockItem ? stockItem.availableKg + (sale?.stockLocationId === stockItem.id ? sale.quantityKg ?? 0 : 0) : undefined
  const previousBalance = summary.isError ? undefined : summary.data?.summary.currentBalancePkr
  const received = form.paymentMethod === 'credit' ? Number(form.amountPaid) : preview
  const oldImpact = sale?.customer === form.customerId ? sale.totalAmount - (sale.amountPaid ?? (sale.paymentMethod === 'credit' ? 0 : sale.totalAmount)) : 0
  const validReceived = received !== undefined && Number.isSafeInteger(received) && received >= 0 && preview !== undefined && received <= preview
  const saleDue = preview === undefined || !validReceived ? undefined : preview - received!
  const projectedBalance = previousBalance === undefined || preview === undefined || !validReceived ? undefined : previousBalance - oldImpact + preview - received!
  const newBalance = projectedBalance !== undefined && Number.isSafeInteger(projectedBalance) && projectedBalance >= 0 ? projectedBalance : undefined
  const enteredQuantity = Number(form.quantity)
  const stockError = stockItem && form.quantity.trim() && Number.isFinite(enteredQuantity) && availableKg !== undefined && enteredQuantity > availableKg
    ? `Insufficient stock for this quantity. Only ${availableKg.toLocaleString('en-PK')} kg is available.`
    : undefined
  const draftValidation = validateSaleForm(form, sale?.customer)
  const hasAvailableStock = stockItem !== undefined && stockItem.teaType === form.teaType && availableKg !== undefined && Number(form.quantity) <= availableKg
  const creditAccountReady = form.paymentMethod !== 'credit' || (!summary.isPending && !summary.isError && projectedBalance !== undefined && projectedBalance >= 0)
  const canSubmit = Boolean(draftValidation.input && form.customerId && hasAvailableStock && creditAccountReady && !restoring && restoredAccountReady && restoredRegionReady)

  function close() {
    if (!submitting && !submitGuard.current && !dialogRef.current?.querySelector('.select-menu.is-open') && confirmLeave()) onClose()
  }
  useCloseOnEscape(close, !submitting)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('input')?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  function updateField<K extends keyof SaleFormValues>(field: K, value: SaleFormValues[K]) {
    setForm(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitGuard.current || submitting) return
    if (!locked && (restoring || !restoredAccountReady || !restoredRegionReady || catalog.isPending || catalog.isError)) return setErrors({ stockLocationId: 'Refresh and review the customer, selling region and stock before saving.' })
    const result = validateSaleForm(form, sale?.customer)
    if (!result.input) return setErrors(result.errors)
    if (!locked && !creditAccountReady) return setErrors({ customerId: 'Refresh and review the customer balance before saving.' })
    if (!locked && stockItem && stockItem.teaType !== form.teaType) return setErrors({ stockLocationId: 'This product changed. Select it again to review its current settings.' })
    if (!locked && !form.customerId) return setErrors({ customerId: 'Select a customer.' })
    if (!locked && (!stockItem || availableKg === undefined)) return setErrors({ stockLocationId: 'Select an available inventory item.' })
    if (!locked && availableKg !== undefined && Number(form.quantity) > availableKg) return setErrors({ quantity: `Only ${availableKg.toLocaleString('en-PK')} kg is currently available.` })
    if (!locked && form.paymentMethod === 'credit' && projectedBalance !== undefined && projectedBalance < 0) return setErrors({ amountPaid: 'This sale change would create a negative Khata balance. Review the customer account first.' })
    submitGuard.current = true
    try { await onSubmit({ ...result.input, ...(sellingRegion ? { sellingRegion } : {}) }) } finally { submitGuard.current = false }
  }

  function fieldError(field: keyof SaleFormValues) {
    return errors[field] && <small id={`sale-${field}-error`} className="field-error">{errors[field]}</small>
  }

  return <div className={editing ? 'edit-sale-backdrop' : 'modal-backdrop'} role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} className={editing ? 'edit-sale-modal' : 'sale-modal'} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={submitting} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
      if (!controls?.length) { event.preventDefault(); return }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className={editing ? 'edit-sale-header' : 'modal-header'}>
        <div><span className="modal-eyebrow">Daily sales entry</span><h2 id={titleId}>{editing ? 'Edit Sale' : 'Add Daily Sale'}</h2></div>
        <button type="button" className="modal-close" onClick={close} disabled={submitting} aria-label={`Close ${editing ? 'edit' : 'add'} sale modal`}><X size={19} /></button>
      </header>
      <form onSubmit={submit} noValidate>
        <fieldset className={editing ? 'edit-sale-grid sale-form-fields' : 'form-grid sale-form-fields'} disabled={submitting || locked}>
          <div className="sale-inline-heading form-field-wide"><strong>Customer Information</strong></div>
          <CustomerSelector value={form.customerId} allowNew={!editing && Boolean(onAddNewCustomer)} error={errors.customerId ?? errors.customerName} onAddNewCustomer={() => {
            if (!submitting && !locked && !submitGuard.current) onAddNewCustomer?.({ form: { ...form }, sellingRegion })
          }} onSelect={customer => { setForm(current => ({ ...current, customerId: customer.id, customerName: customer.name })); setErrors(current => ({ ...current, customerId: undefined, customerName: undefined })) }} />
          {form.customerId && <div className="form-field form-field-wide sale-account-due" aria-live="polite"><span>Current Khata Due</span><strong>{summary.isError ? 'Unavailable' : previousBalance === undefined ? 'Loading...' : formatPKR(previousBalance)}</strong>{summary.isFetching && !summary.isPending && <small>Refreshing...</small>}{previousBalance !== undefined && previousBalance < 0 && <small className="field-error">Balance requires review</small>}{summary.isError && <Button type="button" onClick={() => void summary.refetch()}>Retry balance</Button>}</div>}
          {restoring && <p className="form-field-wide" role="status">Refreshing customer, region and stock before restoring this sale...</p>}
          {initialDraft && !restoring && sellingRegion && !restoredRegionReady && <p className="form-field-wide field-error" role="alert">The saved selling region is unavailable. Choose an active region.</p>}
          {initialDraft && !restoring && form.customerId && restoredCustomer.data?.customer.status !== 'active' && <p className="form-field-wide field-error" role="alert">The selected customer is unavailable. Search for an active customer.</p>}
          {initialDraft && !restoring && form.stockLocationId && !catalog.isError && !stockItem && <p className="form-field-wide field-error" role="alert">The saved product is unavailable in this region. Select an available regional product.</p>}
          <div className="sale-inline-heading form-field-wide"><strong>Sale Information</strong></div>
          <label className="form-field">Sale Date<input type="date" aria-label="Sale Date" value={form.businessDate} onChange={event => updateField('businessDate', event.target.value)} aria-invalid={Boolean(errors.businessDate)} aria-describedby={errors.businessDate ? 'sale-businessDate-error' : undefined} />{fieldError('businessDate')}</label>
          {!legacyEdit && <div className="form-field-wide"><SellingRegionSelector value={sellingRegion} regions={regions} onChange={value => { setSellingRegion(value); setForm(clearSaleStockSelection); setErrors({}) }} /></div>}
          <label className="form-field">Sold By / Salesperson (optional)<input maxLength={160} value={form.salespersonName} onChange={event => updateField('salespersonName', event.target.value)} aria-invalid={Boolean(errors.salespersonName)} placeholder="Enter actual salesperson name" />{fieldError('salespersonName')}</label>
          <label className="form-field">Entered By / Recorded By<input readOnly value={operator?.name ?? catalog.data?.operator.name ?? (catalog.isError ? 'Unavailable' : 'Loading...')} /></label>
          <div className="form-field-wide"><RegionalProductSelector region={sellingRegion} value={form.stockLocationId} catalog={catalog} legacy={legacyEdit} error={errors.stockLocationId ?? errors.teaType} onChange={item => {
            setForm(current => ({ ...current, stockLocationId: item?.id ?? '', teaType: item?.teaType ?? '', quantity: '', unitPrice: item?.sellingPrice == null ? '' : String(item.sellingPrice) }))
            setErrors(current => ({ ...current, stockLocationId: undefined, teaType: undefined, quantity: undefined, unitPrice: undefined }))
          }} />{stockItem && <dl className="sale-stock-details"><div><dt>Product</dt><dd>{stockItem.name}</dd></div><div><dt>Available Stock</dt><dd>{availableKg?.toLocaleString('en-PK')} kg</dd></div><div><dt>Product Type</dt><dd>{stockItem.teaType}</dd></div><div><dt>Selling Price</dt><dd>{stockItem.sellingPrice === null ? 'Not set - enter manually' : formatPKR(stockItem.sellingPrice) + '/kg'}</dd></div></dl>}</div>
          <label className="form-field">Quantity (kg)<input type="number" aria-label="Quantity (kg)" min="0.001" step="0.001" value={form.quantity} onChange={event => updateField('quantity', event.target.value)} aria-invalid={Boolean(errors.quantity || stockError)} aria-describedby={errors.quantity || stockError ? 'sale-quantity-error' : undefined} />{stockError ? <small id="sale-quantity-error" className="field-error">{stockError}</small> : fieldError('quantity')}</label>
          <label className="form-field">Unit Price (PKR)<input type="number" aria-label="Unit Price (PKR)" min="0" step="1" value={form.unitPrice} onChange={event => updateField('unitPrice', event.target.value)} aria-invalid={Boolean(errors.unitPrice)} aria-describedby={errors.unitPrice ? 'sale-unitPrice-error' : undefined} />{fieldError('unitPrice')}</label>
          <div className="sale-inline-heading form-field-wide"><strong>Payment Information</strong></div>
          <div className="form-field"><span>Payment Method</span><SelectMenu value={form.paymentMethod} options={paymentOptions} onChange={value => updateField('paymentMethod', value)} ariaLabel="Sale payment method" className="sales-select-menu sale-form-select" /></div>
          <div className="form-field"><span>Status</span><SelectMenu value={form.status} options={statusOptions} onChange={value => updateField('status', value)} ariaLabel="Sale status" className="sales-select-menu sale-form-select" /></div>
          <div className="form-field calculated-field form-field-wide"><span>Sale Total</span><strong>{preview === undefined ? '-' : formatPKR(preview)}</strong></div>
          {form.paymentMethod === 'credit' && <>
            <label className="form-field">Amount Received Today (PKR)<input type="number" aria-label="Amount Received Today (PKR)" min="0" max={preview} step="1" value={form.amountPaid} onChange={event => updateField('amountPaid', event.target.value)} aria-invalid={Boolean(errors.amountPaid)} aria-describedby={errors.amountPaid ? 'sale-amountPaid-error' : undefined} />{fieldError('amountPaid')}</label>
            <div className="form-field"><span>Received Via</span><SelectMenu value={form.receivedPaymentMethod} options={paymentOptions.filter((option): option is { value: Exclude<SalePaymentMethod, 'credit'>; label: string } => option.value !== 'credit')} onChange={value => updateField('receivedPaymentMethod', value)} ariaLabel="Received payment method" className="sales-select-menu sale-form-select" /></div>
            <dl className="sale-khata-preview form-field-wide" aria-live="polite">
              <div><dt>Previous Khata</dt><dd>{previousBalance === undefined ? '-' : formatPKR(previousBalance)}</dd></div>
              {editing && oldImpact !== 0 && <div><dt>Original Sale Due</dt><dd>- {formatPKR(oldImpact)}</dd></div>}
              <div><dt>Current Sale</dt><dd>{preview === undefined ? '-' : `+ ${formatPKR(preview)}`}</dd></div>
              <div><dt>Paid Today</dt><dd>{validReceived ? `- ${formatPKR(received!)}` : '-'}</dd></div>
              <div><dt>Current Sale Due</dt><dd>{saleDue === undefined ? '-' : formatPKR(saleDue)}</dd></div>
              <div className="sale-new-balance"><dt>{editing ? 'New Khata Preview' : 'Projected Total Khata'}</dt><dd>{newBalance === undefined ? '-' : formatPKR(newBalance)}</dd></div>
            </dl>
          </>}
          {form.paymentMethod !== 'credit' && <dl className="sale-khata-preview sale-cash-preview form-field-wide" aria-live="polite"><div><dt>Current Sale</dt><dd>{preview === undefined ? '-' : formatPKR(preview)}</dd></div><div><dt>Paid Today</dt><dd>{preview === undefined ? '-' : formatPKR(preview)}</dd></div><div><dt>Current Sale Due</dt><dd>{preview === undefined ? '-' : formatPKR(0)}</dd></div><div><dt>Previous Khata</dt><dd>{previousBalance === undefined ? '-' : formatPKR(previousBalance)}</dd></div><div className="sale-new-balance"><dt>{editing ? 'New Khata Preview' : 'Projected Total Khata'}</dt><dd>{newBalance === undefined ? '-' : formatPKR(newBalance)}</dd></div></dl>}
          <label className="form-field form-field-wide edit-sale-notes">Notes<textarea rows={3} maxLength={500} value={form.notes} onChange={event => updateField('notes', event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'sale-notes-error' : undefined} />{fieldError('notes')}</label>
        </fieldset>
        {error && <div className="sale-form-error" role="alert"><p>{getSalesErrorMessage(error)}</p>{error instanceof SalesApiError && error.status < 500 && error.issues?.map((issue, index) => <p key={`${issue.path}-${index}`}>{issue.message}</p>)}</div>}
        <footer className={editing ? 'edit-sale-footer' : 'modal-footer'}>
          {locked && onReset && <Button type="button" onClick={onReset} disabled={submitting} aria-label="Reset sale submission" title="Reset sale submission"><RotateCcw size={16} /></Button>}
          <Button type="button" onClick={close} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting || (!locked && (catalog.isPending || catalog.isError || !canSubmit))}><Save size={16} />{submitting ? 'Saving sale...' : error ? 'Retry Sale' : editing ? 'Save Changes' : 'Save Sale'}</Button>
        </footer>
      </form>
    </section>
  </div>
}
