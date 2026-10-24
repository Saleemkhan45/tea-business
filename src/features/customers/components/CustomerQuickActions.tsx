import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Save, X } from 'lucide-react'
import { PAYMENT_METHODS, type PaymentMethod } from '../../../business/domain/types'
import { getPakistanBusinessDate, isValidBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import { CustomerLedgerApiError, definitiveLedgerFailure, getCustomerLedgerErrorMessage, useCreateCustomerPayment, type CreatePaymentInput } from '../../customer-ledger'
import { AddSaleModal } from '../../sales/components/AddSaleModal'
import { useSaleEntryOptions } from '../../sales/useSales'
import '../../sales/sales.css'
import { useAuthStore } from '../../auth/auth.store'
import { useUnsavedEntryGuard } from '../../../components/shared/useUnsavedEntryGuard'

export type QuickActionMode = 'purchase' | 'payment'
type Props = {
  collectionOccurrence?: string
  expectedAmount?: number
  customerId: string
  customerName?: string
  outstandingPkr?: number
  mode: QuickActionMode
  onClose: () => void
  onSuccess: (message: string) => void
}

const PAYMENT_OPTIONS = PAYMENT_METHODS.map(value => ({ value, label: value.replace('_', ' ').replace(/^./, letter => letter.toUpperCase()) }))

export function CustomerQuickActions(props: Props) {
  return props.mode === 'purchase'
    ? <AddSaleModal initialCustomerId={props.customerId} onClose={props.onClose} onSave={() => props.onSuccess('Sale recorded.')} />
    : <ReceivePaymentDialog {...props} />
}

function ReceivePaymentDialog({ customerId, customerName, outstandingPkr, collectionOccurrence, expectedAmount, onClose, onSuccess }: Props) {
  const today = getPakistanBusinessDate()
  const [businessDate, setBusinessDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(expectedAmount === undefined ? '' : String(Math.min(expectedAmount, outstandingPkr ?? 0)))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLElement>(null)
  const saving = useRef(false)
  const pendingPayment = useRef<Readonly<CreatePaymentInput> | null>(null)
  const uncertainPayment = useRef(false)
  const payment = useCreateCustomerPayment(customerId)
  const operator = useSaleEntryOptions()
  const authenticatedOperator = useAuthStore(state => state.session?.user)
  const isSaving = payment.isPending
  const initialValues = useRef(JSON.stringify({ businessDate, notes, reference, amount, paymentMethod }))
  const confirmLeave = useUnsavedEntryGuard(JSON.stringify({ businessDate, notes, reference, amount, paymentMethod }) !== initialValues.current, isSaving, Boolean(pendingPayment.current) && Boolean(error))
  function close() { if (!isSaving && !saving.current && !dialogRef.current?.querySelector('.select-menu.is-open') && confirmLeave()) onClose() }
  useCloseOnEscape(close, !isSaving)

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || isSaving) return
    setError('')
    const amountPkr = Number(amount)
    if (!pendingPayment.current) {
      if (!isValidBusinessDate(businessDate) || businessDate > today) return setError('Choose a valid payment date.')
      if (!Number.isSafeInteger(amountPkr) || amountPkr <= 0) return setError('Enter a positive whole-PKR payment amount.')
      if (outstandingPkr === undefined || amountPkr > outstandingPkr) return setError('Payment cannot exceed the outstanding balance.')
      pendingPayment.current = Object.freeze({ businessDate, amountPkr, paymentMethod, collectionOccurrence, reference: reference.trim() || undefined, notes: notes.trim() || undefined, idempotencyKey: crypto.randomUUID() })
    }
    saving.current = true
    try {
      await payment.mutateAsync(pendingPayment.current)
      onSuccess('Payment recorded.')
    } catch (issue) {
      if (definitiveLedgerFailure(issue, uncertainPayment.current)) pendingPayment.current = null
      else uncertainPayment.current = true
      setError(issue instanceof CustomerLedgerApiError && (issue.status === 400 || issue.status === 409)
        ? issue.issues?.[0]?.message ?? issue.message
        : getCustomerLedgerErrorMessage(issue))
    } finally { saving.current = false }
  }

  return <div className="customer-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section ref={dialogRef} className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-action-title" aria-busy={isSaving} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
      <header className="customer-modal-header"><div><span>Customer Khata</span><h2 id="customer-action-title">Receive Payment</h2></div><button type="button" onClick={close} disabled={isSaving} aria-label="Close dialog"><X size={19} /></button></header>
      <form onSubmit={submit} noValidate>
        <dl className="customer-payment-context"><div><dt>Customer</dt><dd>{customerName ?? 'Customer account'}</dd></div><div><dt>Current Khata</dt><dd>{outstandingPkr === undefined ? 'Unavailable' : formatPKR(outstandingPkr)}</dd></div></dl>
        <fieldset className="customer-modal-fields sale-form-fields" disabled={isSaving || Boolean(pendingPayment.current)}>
          <label>Amount Received (PKR)<input required type="number" min="1" step="1" max={outstandingPkr} value={amount} onChange={event => setAmount(event.target.value)} /></label>
          <div className="customer-modal-select"><span>Payment Method</span><SelectMenu value={paymentMethod} options={PAYMENT_OPTIONS} onChange={setPaymentMethod} ariaLabel="Payment method" /></div>
          <label>Date<input required type="date" max={today} value={businessDate} onChange={event => setBusinessDate(event.target.value)} /></label>
          <label>Reference / Receipt #<input maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label>
          <label>Entered By<input readOnly value={authenticatedOperator?.name ?? (operator.isError ? 'Unavailable' : operator.data?.operator.name ?? 'Loading...')} /></label>
          <label className="customer-wide-field">Notes<textarea rows={3} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        </fieldset>
        {error && <p className="customer-form-error customer-wide-field" role="alert">{error}</p>}
        <footer className="customer-modal-footer"><Button type="button" onClick={close} disabled={isSaving}>Cancel</Button><Button type="submit" variant="primary" loading={isSaving} disabled={isSaving || (!pendingPayment.current && (outstandingPkr === undefined || outstandingPkr <= 0))}><Save size={16} />{isSaving ? 'Saving...' : pendingPayment.current ? 'Retry Payment' : 'Record Payment'}</Button></footer>
      </form>
    </section>
  </div>
}
