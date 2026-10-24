import { Banknote, Download, Printer, ReceiptText, WalletCards, X } from 'lucide-react'
import { useEffect } from 'react'
import { Badge, useCloseOnEscape } from '../../../components/shared'
import type { SaleRecord } from '../types/sales'
import { downloadSalePdf } from '../utils/downloadSalePdf'

type SalePaymentsModalProps = {
  sale: SaleRecord
  onClose: () => void
}

const formatCurrency = (value: number) => `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

export function SalePaymentsModal({ sale, onClose }: SalePaymentsModalProps) {
  useCloseOnEscape(onClose)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  const isPaid = sale.status === 'Completed'
  const paidAmount = isPaid ? sale.totalAmount : 0
  const dueAmount = sale.totalAmount - paidAmount
  const reference = sale.id.replace('sale-', 'SL').toUpperCase()

  return <div className="payment-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <header className="payment-modal-header">
        <div className="payment-modal-title"><span><WalletCards size={18} /></span><div><small>Payment activity</small><h2 id="payment-modal-title">Payment Details</h2><p>Sale #{reference}</p></div></div>
        <button type="button" className="payment-modal-close" onClick={onClose} aria-label="Close payment details"><X size={18} /></button>
      </header>

      <div className="payment-modal-content">
        <div className="payment-summary">
          <div><span>Grand total</span><strong>{formatCurrency(sale.totalAmount)}</strong></div>
          <div className="is-paid"><span>Amount paid</span><strong>{formatCurrency(paidAmount)}</strong></div>
          <div className={dueAmount > 0 ? 'is-due' : ''}><span>Balance due</span><strong>{formatCurrency(dueAmount)}</strong></div>
        </div>

        <div className="payment-section-heading"><div><h3>Payment History</h3><p>{isPaid ? '1 payment recorded for this sale' : 'No payments recorded for this sale'}</p></div><Badge tone={isPaid ? 'success' : 'warning'}>{isPaid ? 'Paid' : 'Payment due'}</Badge></div>

        {isPaid ? <div className="payment-record">
          <div className="payment-record-icon"><Banknote size={19} /></div>
          <div className="payment-record-main"><strong>{formatCurrency(paidAmount)}</strong><span>Full payment</span></div>
          <dl><div><dt>Date</dt><dd>{formatDate(sale.date)}</dd></div><div><dt>Reference</dt><dd>PAY-{reference}</dd></div><div><dt>Received by</dt><dd>{sale.enteredBy}</dd></div><div><dt>Method</dt><dd>Cash</dd></div></dl>
          <div className="payment-record-actions"><button type="button" onClick={() => window.print()} aria-label="Print payment receipt" title="Print receipt"><Printer size={16} /></button><button type="button" onClick={() => downloadSalePdf(sale)} aria-label="Download complete sale PDF" title="Download complete PDF"><Download size={16} /></button></div>
        </div> : <div className="payment-empty"><span><ReceiptText size={22} /></span><strong>No payment received</strong><p>The full balance of {formatCurrency(dueAmount)} is still outstanding.</p></div>}

        <div className="payment-progress" aria-label={`${isPaid ? 100 : 0}% paid`}><div><span>Payment progress</span><strong>{isPaid ? '100%' : '0%'}</strong></div><span className="payment-progress-track"><i style={{ width: isPaid ? '100%' : '0%' }} /></span></div>
      </div>

      <footer className="payment-modal-footer"><span>Sale date: {formatDate(sale.date)}</span><button type="button" onClick={onClose}>Close</button></footer>
    </section>
  </div>
}
