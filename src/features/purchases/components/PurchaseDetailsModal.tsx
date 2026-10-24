import { Banknote, Download, FileText, PackageCheck, ReceiptText, X } from 'lucide-react'
import { useEffect } from 'react'
import { Badge, Button, useCloseOnEscape } from '../../../components/shared'
import type { PurchaseRecord } from '../types/purchases'
import { downloadPurchasePdf } from '../utils/downloadPurchasePdf'

type Props = { purchase: PurchaseRecord; onClose: () => void }

const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${value}T00:00:00`))

export function PurchaseDetailsModal({ purchase, onClose }: Props) {
  useCloseOnEscape(onClose)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  const subtotal = purchase.quantityKg * purchase.costPerKg
  const paid = purchase.paidAmount ?? 0
  const due = Math.max(purchase.totalCost - paid, 0)
  const paymentStatus = due === 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid'
  const paymentTone = due === 0 ? 'success' : paid > 0 ? 'warning' : 'neutral'
  const orderTone = purchase.status === 'Received' ? 'success' : purchase.status === 'Pending' ? 'warning' : 'neutral'

  return <div className="purchase-workflow-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="purchase-detail-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title">
      <header className="purchase-workflow-header">
        <div><span className="purchase-workflow-icon"><PackageCheck size={20} /></span><div><small>Purchase record</small><h2 id="purchase-detail-title">Purchase Details</h2><p>Purchase No. {purchase.purchaseNumber}</p></div></div>
        <div><button type="button" onClick={() => downloadPurchasePdf(purchase)} aria-label="Download purchase PDF" title="Download PDF"><Download size={18} /></button><button type="button" onClick={onClose} aria-label="Close purchase details"><X size={19} /></button></div>
      </header>

      <div className="purchase-detail-content">
        <div className="purchase-detail-grid">
          <div><span>Purchase No.</span><strong>{purchase.purchaseNumber}</strong></div>
          <div><span>Supplier Name</span><strong>{purchase.supplier}</strong></div>
          <div><span>Purchase Date</span><strong>{formatDate(purchase.date)}</strong></div>
          <div><span>Purchase Region</span><strong>{purchase.region}</strong></div>
          <div><span>Order Status</span><Badge tone={orderTone}>{purchase.status}</Badge></div>
          <div><span>Grand Total</span><strong>{money(purchase.totalCost)}</strong></div>
        </div>

        <section className="purchase-detail-section" aria-labelledby="purchase-detail-items-title">
          <div className="purchase-detail-section-heading">
            <div><PackageCheck size={17} /><div><h3 id="purchase-detail-items-title">Purchase Items</h3><p>Quantity and pricing recorded for this order.</p></div></div>
            <span>1 item</span>
          </div>
          <div className="purchase-detail-table">
            <table>
              <thead><tr><th>Product</th><th>Quantity (kg)</th><th>Unit Price (PKR)</th><th>Discount</th><th>Tax</th><th>Unit Cost</th><th>Total Cost</th></tr></thead>
              <tbody><tr><td><span className={`tea-chip ${purchase.teaType === 'Green Tea' ? 'green-chip' : 'black-chip'}`} /><strong>{purchase.teaType}</strong></td><td>{purchase.quantityKg.toLocaleString()} kg</td><td>{money(purchase.costPerKg)}</td><td>{money(purchase.discountAmount)}</td><td>{money(purchase.taxAmount)}</td><td>{money(purchase.costPerKg)}</td><td><strong>{money(purchase.totalCost)}</strong></td></tr></tbody>
            </table>
          </div>
        </section>

        <div className="purchase-detail-lower">
          <section aria-labelledby="purchase-cost-summary-title">
            <div className="purchase-detail-section-heading is-compact"><div><ReceiptText size={17} /><h3 id="purchase-cost-summary-title">Cost Summary</h3></div></div>
            <div className="purchase-detail-totals">
              <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <div><span>Order Tax</span><strong>{money(purchase.taxAmount)}</strong></div>
              <div><span>Discount</span><strong>- {money(purchase.discountAmount)}</strong></div>
              <div><span>Shipping</span><strong>{money(purchase.shippingAmount)}</strong></div>
              <div className="is-grand-total"><span>Grand Total</span><strong>{money(purchase.totalCost)}</strong></div>
            </div>
          </section>

          <section aria-labelledby="purchase-payment-summary-title">
            <div className="purchase-detail-section-heading is-compact"><div><Banknote size={17} /><h3 id="purchase-payment-summary-title">Payment Summary</h3></div></div>
            <div className="purchase-detail-payment">
              <div><span>Payment Status</span><Badge tone={paymentTone}>{paymentStatus}</Badge></div>
              <div><span>Amount Paid</span><strong>{money(paid)}</strong></div>
              <div className={due > 0 ? 'has-due' : ''}><span>Balance Due</span><strong>{money(due)}</strong></div>
              <div><span>Payment Method</span><strong>{purchase.paymentMethod ?? 'Not recorded'}</strong></div>
            </div>
          </section>
        </div>

        <section className={`purchase-detail-notes ${purchase.notes ? '' : 'is-empty'}`} aria-labelledby="purchase-description-title">
          <div><FileText size={16} /><span id="purchase-description-title">Description</span></div>
          <p>{purchase.notes || 'No description provided.'}</p>
        </section>
      </div>

      <footer className="purchase-workflow-footer"><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={() => downloadPurchasePdf(purchase)}><Download size={16} /> Download PDF</Button></footer>
    </section>
  </div>
}
