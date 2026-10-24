import { CreditCard, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import type { PurchaseRecord } from '../types/purchases'

type Props = { purchase: PurchaseRecord; createMode?: boolean; onClose: () => void; onSave: (purchase: PurchaseRecord) => void }
type Method = 'Cash' | 'Bank Transfer' | 'Cheque'
const METHODS: Array<{ value: Method; label: string }> = [{ value: 'Cash', label: 'Cash' }, { value: 'Bank Transfer', label: 'Bank Transfer' }, { value: 'Cheque', label: 'Cheque' }]
const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`

export function PurchasePaymentsModal({ purchase, createMode = false, onClose, onSave }: Props) {
  const paid = purchase.paidAmount ?? 0
  const due = Math.max(purchase.totalCost - paid, 0)
  const [amount, setAmount] = useState(String(due))
  const [method, setMethod] = useState<Method>('Bank Transfer')
  useCloseOnEscape(onClose)
  useEffect(() => { const value = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = value } }, [])
  function submit(event: FormEvent) { event.preventDefault(); const value = Math.min(Math.max(Number(amount) || 0, 0), due); if (!value) return; onSave({ ...purchase, paidAmount: paid + value, paymentMethod: method }) }
  return <div className="purchase-workflow-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="purchase-payment-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-payment-title"><header className="purchase-workflow-header"><div><span className="purchase-workflow-icon"><CreditCard size={20} /></span><div><small>Supplier payment</small><h2 id="purchase-payment-title">{createMode ? 'Create Payment' : 'Payment Details'}</h2><p>{purchase.supplier}</p></div></div><button type="button" onClick={onClose} aria-label="Close payment modal"><X size={19} /></button></header><div className="purchase-payment-summary"><div><span>Purchase Total</span><strong>{money(purchase.totalCost)}</strong></div><div><span>Paid</span><strong>{money(paid)}</strong></div><div className={due ? 'has-due' : ''}><span>Balance Due</span><strong>{money(due)}</strong></div></div>{createMode ? <form onSubmit={submit}><label className="form-field">Payment Amount<input autoFocus type="number" min="1" max={due} value={amount} onChange={event => setAmount(event.target.value)} /></label><div className="form-field"><span>Payment Method</span><SelectMenu value={method} options={METHODS} onChange={setMethod} ariaLabel="Payment method" className="purchase-select-menu" /></div><footer className="purchase-workflow-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={due === 0}>Save Payment</Button></footer></form> : <div className="purchase-payment-history">{paid > 0 ? <div><span className="purchase-workflow-icon"><CreditCard size={18} /></span><div><strong>{money(paid)}</strong><p>{purchase.paymentMethod ?? 'Payment recorded'} · {purchase.date}</p></div></div> : <div className="purchase-payment-empty"><strong>No payment recorded</strong><p>{money(due)} remains outstanding.</p></div>}<footer className="purchase-workflow-footer"><Button onClick={onClose}>Close</Button></footer></div>}</section></div>
}
