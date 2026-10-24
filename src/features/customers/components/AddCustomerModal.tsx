import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PackagePlus, RotateCcw, UserPlus, X } from 'lucide-react'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import { formatPKR } from '../../../business/utils/formatters'
import { useAuthStore } from '../../auth/auth.store'
import { CustomerLedgerApiError, getCustomerLedgerErrorMessage, useCreateCustomer } from '../../customer-ledger'
import { getSalesErrorMessage } from '../../sales/services/sales.service'
import type { SaleWriteInput } from '../../sales/types/salesApi'
import { useSaleSubmission } from '../../sales/useSaleSubmission'
import { useRegions } from '../../regions/regionalInventory.api'
import { useSaleEntryOptions } from '../../sales/useSales'
import { SellingRegionSelector, RegionalProductSelector } from '../../sales/components/RegionalSaleSelectors'
import { CustomerFields } from './CustomerFields'
import {
  EMPTY_CUSTOMER_DRAFT,
  normalizeCustomerDraft,
  normalizeOpeningBalance,
  runSingleCustomerSubmission,
  validateCustomerDraft,
  validateOpeningBalance,
  type CustomerDraft,
  type CustomerDraftErrors,
} from '../customerForm'
import {
  calculateFirstSaleTotal,
  firstSaleAmountPaid,
  initialFirstSaleDraft,
  validateFirstSaleDraft,
  type FirstSaleDraft,
  type FirstSaleDraftErrors,
  type FirstSalePaymentMode,
} from '../customerOnboarding'

type Props = {
  onClose: () => void
  onSaved: (customerName: string, customerId?: string) => void
  fromSale?: boolean
}

const paymentOptions: Array<{ value: FirstSalePaymentMode; label: string }> = [
  { value: 'cash', label: 'Cash — fully paid' },
  { value: 'khata', label: 'Khata — full amount due' },
  { value: 'mixed', label: 'Mixed — part paid, part due' },
]

export function AddCustomerModal({ onClose, onSaved, fromSale = false }: Props) {
  const [draft, setDraft] = useState<CustomerDraft>({ ...EMPTY_CUSTOMER_DRAFT })
  const [openingBalance, setOpeningBalance] = useState('0')
  const [firstSale, setFirstSale] = useState<FirstSaleDraft>(() => initialFirstSaleDraft())
  const firstSaleEnabled = !fromSale && firstSale.enabled
  const [errors, setErrors] = useState<CustomerDraftErrors>({})
  const [openingBalanceError, setOpeningBalanceError] = useState<string>()
  const [firstSaleErrors, setFirstSaleErrors] = useState<FirstSaleDraftErrors>({})
  const [requestError, setRequestError] = useState('')
  const createCustomer = useCreateCustomer()
  const saleSubmission = useSaleSubmission()
  const [sellingRegion, setSellingRegion] = useState('')
  const regions = useRegions()
  const catalog = useSaleEntryOptions(sellingRegion || undefined, firstSaleEnabled && Boolean(sellingRegion))
  const operator = useAuthStore(state => state.session?.user)
  const submitGuard = useRef(false)
  const firstSaleRequest = useRef<SaleWriteInput | null>(null)
  const customerIdempotencyKeyRef = useRef(crypto.randomUUID())
  const dialogRef = useRef<HTMLElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const selectedItem = sellingRegion ? catalog.data?.items.find(item => item.id === firstSale.stockLocationId && item.regionId === sellingRegion) : undefined
  const totalPkr = calculateFirstSaleTotal(firstSale)
  const amountPaidPkr = firstSaleAmountPaid(firstSale, totalPkr)
  const duePkr = totalPkr === undefined || amountPaidPkr === undefined || !Number.isSafeInteger(amountPaidPkr)
    ? undefined
    : totalPkr - amountPaidPkr
  const locked = !fromSale && saleSubmission.status === 'error' && saleSubmission.hasActiveRequest
  const isSaving = createCustomer.isPending || saleSubmission.status === 'submitting'

  useCloseOnEscape(() => { if (!dialogRef.current?.querySelector('.select-menu.is-open')) onClose() }, !isSaving)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    nameInputRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [])
  useEffect(() => {
    if (saleSubmission.error) setRequestError(getSalesErrorMessage(saleSubmission.error))
  }, [saleSubmission.error])

  function update(field: keyof CustomerDraft, value: string) {
    setDraft(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    setRequestError('')
  }

  function updateFirstSale<K extends keyof FirstSaleDraft>(field: K, value: FirstSaleDraft[K]) {
    setFirstSale(current => ({ ...current, [field]: value }))
    setFirstSaleErrors(current => ({ ...current, [field]: undefined }))
    setRequestError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitGuard.current || isSaving) return
    if (locked && firstSaleRequest.current) {
      const sale = await saleSubmission.submit(firstSaleRequest.current)
      if (sale) onSaved(draft.name.trim(), sale.customer)
      return
    }
    const nextErrors = validateCustomerDraft(draft)
    const nextOpeningError = validateOpeningBalance(openingBalance)
    const nextFirstSaleErrors = validateFirstSaleDraft({ ...firstSale, enabled: firstSaleEnabled }, selectedItem?.availableKg)
    if (firstSaleEnabled && (!sellingRegion || !selectedItem)) nextFirstSaleErrors.stockLocationId = 'Choose a selling region and product.'
    setErrors(nextErrors)
    setOpeningBalanceError(nextOpeningError)
    setFirstSaleErrors(nextFirstSaleErrors)
    if (Object.keys(nextErrors).length > 0 || nextOpeningError || Object.keys(nextFirstSaleErrors).length > 0) return

    const customer = normalizeCustomerDraft(draft)
    const openingBalancePkr = normalizeOpeningBalance(openingBalance)
    const newCustomer = { ...customer, ...(openingBalancePkr > 0 ? { openingBalancePkr } : {}) }
    setRequestError('')

    if (firstSaleEnabled && selectedItem && totalPkr !== undefined && amountPaidPkr !== undefined) {
      const request: SaleWriteInput = {
        newCustomer,
        customerName: customer.name,
        businessDate: firstSale.businessDate,
        stockLocationId: selectedItem.id,
        sellingRegion,
        teaType: selectedItem.teaType,
        quantityKg: Number(firstSale.quantity),
        unitPrice: Number(firstSale.unitPrice),
        amountPaid: amountPaidPkr,
        receivedPaymentMethod: 'cash',
        paymentMethod: firstSale.paymentMode === 'cash' ? 'cash' : 'credit',
        status: 'completed',
        salespersonName: firstSale.salespersonName.trim() || null,
        notes: firstSale.notes.trim() || null,
      }
      firstSaleRequest.current = request
      const sale = await saleSubmission.submit(request)
      if (sale) onSaved(customer.name, sale.customer)
      return
    }

    try {
      const result = await runSingleCustomerSubmission(submitGuard, () => createCustomer.mutateAsync({
        ...customer,
        openingBalancePkr,
        idempotencyKey: customerIdempotencyKeyRef.current,
      }))
      if (result) onSaved(result.customer.name, result.customer.id)
    } catch (error) {
      if (error instanceof CustomerLedgerApiError && error.issues?.length) {
        const fieldErrors: CustomerDraftErrors = {}
        for (const issue of error.issues) {
          const field = issue.path.split('.').at(-1)
          if (field === 'name' || field === 'phone' || field === 'address' || field === 'city' || field === 'region' || field === 'notes') {
            fieldErrors[field] = issue.message
          } else if (field === 'openingBalancePkr') {
            setOpeningBalanceError(issue.message)
          }
        }
        setErrors(fieldErrors)
      }
      setRequestError(getCustomerLedgerErrorMessage(error))
    }
  }

  return <div className="customer-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !isSaving && onClose()}>
    <section ref={dialogRef} className="customer-modal customer-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-customer-title" aria-busy={isSaving} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
      if (!controls?.length) { event.preventDefault(); return }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className="customer-modal-header"><div><span>Customer directory</span><h2 id="add-customer-title">Add Customer</h2></div><button type="button" onClick={onClose} disabled={isSaving} aria-label="Close add customer modal"><X size={18} /></button></header>
      <form onSubmit={submit} noValidate>
        <fieldset className="customer-onboarding-fields" disabled={isSaving || locked}>
          <section className="customer-onboarding-section" aria-labelledby="customer-info-heading">
            <div className="customer-onboarding-heading"><span>1</span><div><h3 id="customer-info-heading">Customer Information</h3><p>Identity and contact details for the customer account.</p></div></div>
            <div className="customer-modal-fields"><CustomerFields regionOptions={regions.data} draft={draft} errors={errors} idPrefix="add-customer" disabled={isSaving || locked} nameInputRef={nameInputRef} onChange={update} /></div>
          </section>

          <section className="customer-onboarding-section" aria-labelledby="opening-khata-heading">
            <div className="customer-onboarding-heading"><span>2</span><div><h3 id="opening-khata-heading">Opening Khata</h3><p>Optional previous due recorded as an auditable opening-balance ledger entry.</p></div></div>
            <div className="customer-modal-fields customer-opening-fields"><label htmlFor="add-customer-opening-balance">Old Khata / Previous Due <small>(optional)</small>
              <input id="add-customer-opening-balance" type="number" inputMode="numeric" min="0" step="1" value={openingBalance} onChange={event => { setOpeningBalance(event.target.value); setOpeningBalanceError(undefined); setRequestError('') }} aria-invalid={Boolean(openingBalanceError)} aria-describedby={openingBalanceError ? 'add-customer-opening-balance-error' : 'add-customer-opening-balance-help'} />
              <small id="add-customer-opening-balance-help">Defaults to PKR 0. Negative balances are not allowed.</small>
              {openingBalanceError && <small id="add-customer-opening-balance-error" className="field-error" role="alert">{openingBalanceError}</small>}
            </label></div>
          </section>

          <section className="customer-onboarding-section" aria-labelledby="first-sale-heading">
            <div className="customer-onboarding-heading"><span>3</span><div><h3 id="first-sale-heading">Optional First Purchase</h3><p>Create the customer, sale, stock movement and Khata entries together.</p></div></div>
            {fromSale ? <p role="status">Complete your sale after returning to Sales. No first purchase will be created here.</p> : <label className="customer-first-sale-toggle"><input type="checkbox" checked={firstSaleEnabled} onChange={event => updateFirstSale('enabled', event.target.checked)} /><span><strong>Add the customer’s first purchase now</strong><small>You can leave this off and add a sale later.</small></span></label>}
            {firstSaleEnabled && <div className="customer-first-sale-fields">
              <label>Sale Date <b aria-hidden="true">*</b><input type="date" required value={firstSale.businessDate} onChange={event => updateFirstSale('businessDate', event.target.value)} aria-invalid={Boolean(firstSaleErrors.businessDate)} />{firstSaleErrors.businessDate && <small className="field-error" role="alert">{firstSaleErrors.businessDate}</small>}</label>
              <SellingRegionSelector value={sellingRegion} regions={regions} onChange={value => { setSellingRegion(value); setFirstSale(current => ({ ...current, stockLocationId: '', quantity: '', unitPrice: '' })); setFirstSaleErrors({}) }} />
              <label>Sold By / Salesperson <small>(optional)</small><input maxLength={160} value={firstSale.salespersonName} onChange={event => updateFirstSale('salespersonName', event.target.value)} aria-invalid={Boolean(firstSaleErrors.salespersonName)} placeholder="Enter actual salesperson name" />{firstSaleErrors.salespersonName && <small className="field-error" role="alert">{firstSaleErrors.salespersonName}</small>}</label>
              <label>Entered By / Recorded By<input readOnly value={operator?.name ?? catalog.data?.operator.name ?? 'Authenticated operator'} /></label>
              <RegionalProductSelector region={sellingRegion} value={firstSale.stockLocationId} catalog={catalog} error={firstSaleErrors.stockLocationId} onChange={item => {
                setFirstSale(current => ({ ...current, stockLocationId: item?.id ?? '', quantity: '', unitPrice: item?.sellingPrice == null ? '' : String(item.sellingPrice) }))
                setFirstSaleErrors(current => ({ ...current, stockLocationId: undefined, quantity: undefined, unitPrice: undefined }))
              }} />
              {selectedItem && <div className="customer-first-sale-stock"><PackagePlus size={16} aria-hidden="true" /><span><strong>{selectedItem.name}</strong><small>{selectedItem.availableKg.toLocaleString('en-PK')} kg currently available</small></span></div>}
              <label>Quantity (kg) <b aria-hidden="true">*</b><input type="number" required inputMode="decimal" min="0.001" step="0.001" value={firstSale.quantity} onChange={event => updateFirstSale('quantity', event.target.value)} aria-invalid={Boolean(firstSaleErrors.quantity)} />{firstSaleErrors.quantity && <small className="field-error" role="alert">{firstSaleErrors.quantity}</small>}</label>
              <label>Unit Price (PKR/kg) <b aria-hidden="true">*</b><input type="number" required inputMode="numeric" min="1" step="1" value={firstSale.unitPrice} onChange={event => updateFirstSale('unitPrice', event.target.value)} aria-invalid={Boolean(firstSaleErrors.unitPrice)} />{firstSaleErrors.unitPrice && <small className="field-error" role="alert">{firstSaleErrors.unitPrice}</small>}</label>
              <label>Sale Total<input readOnly value={totalPkr === undefined ? '' : formatPKR(totalPkr)} aria-label="First sale total amount" /></label>
              <div className="customer-modal-select"><span>Payment Method</span><SelectMenu value={firstSale.paymentMode} options={paymentOptions} onChange={value => updateFirstSale('paymentMode', value)} ariaLabel="First sale payment method" /></div>
              <label>Amount Paid<input type="number" inputMode="numeric" min="0" step="1" readOnly={firstSale.paymentMode !== 'mixed'} value={amountPaidPkr === undefined ? firstSale.amountPaid : String(amountPaidPkr)} onChange={event => updateFirstSale('amountPaid', event.target.value)} aria-invalid={Boolean(firstSaleErrors.amountPaid)} />{firstSaleErrors.amountPaid && <small className="field-error" role="alert">{firstSaleErrors.amountPaid}</small>}</label>
              <label>Current Sale Due<input readOnly value={duePkr === undefined || duePkr < 0 ? '' : formatPKR(duePkr)} aria-label="First sale amount due" /></label>
              <label>Previous Khata<input readOnly value={!Number.isSafeInteger(Number(openingBalance)) || Number(openingBalance) < 0 ? '' : formatPKR(Number(openingBalance))} /></label>
              <label>Projected Total Khata<input readOnly value={duePkr === undefined || duePkr < 0 || !Number.isSafeInteger(Number(openingBalance)) || Number(openingBalance) < 0 || !Number.isSafeInteger(Number(openingBalance) + duePkr) ? '' : formatPKR(Number(openingBalance) + duePkr)} /></label>
              <label>Purchase Notes <small>(optional)</small><textarea rows={3} maxLength={500} value={firstSale.notes} onChange={event => updateFirstSale('notes', event.target.value)} aria-invalid={Boolean(firstSaleErrors.notes)} />{firstSaleErrors.notes && <small className="field-error" role="alert">{firstSaleErrors.notes}</small>}</label>
            </div>}
          </section>
        </fieldset>
        {requestError && <p className="customer-form-error" role="alert">{requestError}</p>}
        <footer className="customer-modal-footer">
          {locked && <Button type="button" aria-label="Reset customer first sale submission" onClick={() => { saleSubmission.reset(); setRequestError('') }}><RotateCcw size={16} /> Start Over</Button>}
          <Button type="button" onClick={onClose} disabled={isSaving}>{fromSale ? 'Back to Sale' : 'Cancel'}</Button>
          <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving || (firstSaleEnabled && !locked && (catalog.isPending || catalog.isError))}><UserPlus size={16} /> {isSaving ? 'Saving...' : locked ? 'Retry Save' : 'Save Customer'}</Button>
        </footer>
      </form>
    </section>
  </div>
}
