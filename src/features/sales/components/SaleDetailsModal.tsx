import { ArrowLeft, Download, MapPin, Printer, ReceiptText, UserRound, X } from 'lucide-react'
import { useEffect } from 'react'
import { Badge, Button, useCloseOnEscape } from '../../../components/shared'
import type { SaleRecord } from '../types/sales'
import { downloadSalePdf } from '../utils/downloadSalePdf'

type SaleDetailsModalProps = {
  sale: SaleRecord
  onClose: () => void
}

const formatCurrency = (value: number | undefined) => value === undefined ? '-' : `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

export function SaleDetailsModal({ sale, onClose }: SaleDetailsModalProps) {
  useCloseOnEscape(onClose)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  return <div className="sale-detail-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="sale-detail-modal" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
      <header className="sale-detail-header">
        <div className="sale-detail-title">
          <span className="sale-detail-title-icon"><ReceiptText size={19} /></span>
          <div><span>Sales record</span><h2 id="sale-detail-title">Sale Details</h2></div>
        </div>
        <div className="sale-detail-actions">
          <button type="button" className="sale-detail-icon-button" onClick={() => downloadSalePdf(sale)} aria-label="Download sale as PDF" title="Download PDF"><Download size={17} /></button>
          <button type="button" className="sale-detail-icon-button" onClick={() => window.print()} aria-label="Print sale details" title="Print"><Printer size={17} /></button>
          <Button className="sale-detail-back" onClick={onClose}><ArrowLeft size={16} /> Back to Sales</Button>
          <button type="button" className="sale-detail-close" onClick={onClose} aria-label="Close sale details"><X size={19} /></button>
        </div>
      </header>

      <div className="sale-detail-content">
        <div className="sale-detail-overview">
          <section className="sale-detail-info">
            <div className="sale-detail-section-heading"><UserRound size={16} /><span>Sale Information</span></div>
            <dl>
              <div><dt>Customer</dt><dd>{sale.customerName}</dd></div>
              <div><dt>Entered by</dt><dd>{sale.enteredBy}</dd></div>
              <div><dt>Sold By / Salesperson</dt><dd>{sale.soldBy || 'Not recorded'}</dd></div>
              <div><dt>Tea type</dt><dd>{sale.teaType}</dd></div>
              <div><dt>Quantity</dt><dd>{sale.quantityKg === undefined ? '-' : `${sale.quantityKg.toLocaleString()} kg`}</dd></div>
            </dl>
          </section>
          <section className="sale-detail-info">
            <div className="sale-detail-section-heading"><MapPin size={16} /><span>Location Information</span></div>
            <dl>
              <div><dt>Region</dt><dd>{sale.region}</dd></div>
              <div><dt>Tea / Product</dt><dd>{sale.source?.productName ?? sale.teaType}</dd></div>
              <div><dt>Sale date</dt><dd>{formatDate(sale.date)}</dd></div>
              <div><dt>Record source</dt><dd>Daily sales</dd></div>
            </dl>
          </section>
          <section className="sale-detail-info sale-detail-invoice">
            <div className="sale-detail-section-heading"><ReceiptText size={16} /><span>Invoice Information</span></div>
            <dl>
              <div><dt>Status</dt><dd><Badge tone={sale.paymentStatus === 'Cancelled' ? 'danger' : sale.paymentStatus === 'Paid' ? 'success' : 'warning'}>{sale.paymentStatus}</Badge></dd></div>
              <div><dt>Payment method</dt><dd>{sale.paymentMethod ?? '-'}</dd></div>
            </dl>
          </section>
        </div>

        <section className="sale-order-summary">
          <h3>Order Summary</h3>
          <div className="sale-detail-table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Status</th><th>Total</th></tr></thead>
              <tbody><tr><td><span className={`tea-chip ${sale.teaType === 'Green Tea' ? 'green-chip' : 'black-chip'}`} /><strong>{sale.teaType}</strong></td><td>{sale.quantityKg === undefined ? '-' : `${sale.quantityKg.toLocaleString()} kg`}</td><td>{formatCurrency(sale.unitPrice)}</td><td>{sale.status}</td><td><strong>{formatCurrency(sale.totalAmount)}</strong></td></tr></tbody>
            </table>
          </div>
        </section>

        <div className="sale-detail-totals">
          <div><span>Subtotal</span><strong>{formatCurrency(sale.totalAmount)}</strong></div>
          <div><span>Received with sale</span><strong>{sale.paymentStatus === 'Cancelled' ? '-' : formatCurrency(sale.amountPaid)}</strong></div>
          <div><span>Sale Due</span><strong>{sale.paymentStatus === 'Cancelled' ? '-' : formatCurrency(sale.amountDue)}</strong></div>
          <div className="is-grand-total"><span>Grand Total</span><strong>{formatCurrency(sale.totalAmount)}</strong></div>
        </div>

        {sale.notes && <section className="sale-detail-notes"><h3>Notes</h3><p>{sale.notes}</p></section>}
      </div>

      <footer className="sale-detail-footer"><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Details</Button></footer>
    </section>
  </div>
}
