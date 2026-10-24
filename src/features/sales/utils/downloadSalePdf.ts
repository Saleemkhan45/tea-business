import type { SaleRecord } from '../types/sales'

const formatCurrency = (value: number | undefined) => value === undefined ? '-' : `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

export function downloadSalePdf(sale: SaleRecord) {
  const reference = sale.id.replace('sale-', 'SL').toUpperCase()
  const isCompleted = sale.status === 'Completed'
  const paymentMethod = sale.source?.paymentMethod?.replace('_', ' ') ?? '-'
  const frame = document.createElement('iframe')
  frame.setAttribute('title', `Sale ${reference} PDF`)
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)

  const printDocument = frame.contentDocument
  if (!printDocument) {
    frame.remove()
    return
  }

  printDocument.open()
  printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tea Business - Sale ${escapeHtml(reference)}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#223249;font:12px Arial,sans-serif}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid #1479d5}.brand h1{margin:0;color:#172033;font-size:24px}.brand p,.invoice p{margin:5px 0 0;color:#718096}.invoice{text-align:right}.invoice strong{display:block;color:#1479d5;font-size:18px}.section{margin-top:24px}.section h2{margin:0 0 11px;color:#173b60;font-size:13px}.details{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.detail{padding:11px 12px;background:#f6f8fb;border:1px solid #dce4ed}.detail span{display:block;color:#7b899c;font-size:9px;text-transform:uppercase}.detail strong{display:block;margin-top:5px;font-size:11px}table{width:100%;border-collapse:collapse}th{padding:11px;color:#34445b;background:#eef3f7;border:1px solid #d8e1ea;font-size:10px;text-align:left}td{padding:12px;border:1px solid #dfe6ed;font-size:11px}.totals{width:46%;margin:18px 0 0 auto;border:1px solid #d8e1ea}.totals div{display:flex;justify-content:space-between;padding:9px 11px;border-top:1px solid #e4eaf0}.totals div:first-child{border-top:0}.totals .grand{color:#1479d5;background:#f4f8fc;font-weight:bold}.payment{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8e1ea}.payment div{padding:11px;border-left:1px solid #e4eaf0}.payment div:first-child{border-left:0}.payment span{display:block;color:#7b899c;font-size:9px}.payment strong{display:block;margin-top:5px;font-size:10px}.status{display:inline-block;padding:4px 7px;color:${isCompleted ? '#16845b' : '#a56812'};background:${isCompleted ? '#e9f8f1' : '#fff5df'};font-weight:bold}.notes{padding:12px;background:#f8fafc;border-left:3px solid #1479d5;line-height:1.5}.footer{margin-top:34px;padding-top:12px;color:#8a97a9;border-top:1px solid #dce4ed;font-size:9px;text-align:center}
  </style></head><body>
    <header class="header"><div class="brand"><h1>Tea Business</h1><p>Sales record</p></div><div class="invoice"><strong>#${escapeHtml(reference)}</strong><p>${escapeHtml(formatDate(sale.date))}</p><p class="status">${escapeHtml(sale.status)}</p></div></header>
    <section class="section"><h2>Sale Information</h2><div class="details"><div class="detail"><span>Customer</span><strong>${escapeHtml(sale.customerName)}</strong></div><div class="detail"><span>Region</span><strong>${escapeHtml(sale.region)}</strong></div><div class="detail"><span>Sold By</span><strong>${escapeHtml(sale.soldBy || 'Not recorded')}</strong></div><div class="detail"><span>Entered By</span><strong>${escapeHtml(sale.enteredBy)}</strong></div><div class="detail"><span>Payment Method</span><strong>${escapeHtml(paymentMethod)}</strong></div></div></section>
    <section class="section"><h2>Order Details</h2><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Status</th><th>Total</th></tr></thead><tbody><tr><td>${escapeHtml(sale.teaType)}</td><td>${sale.quantityKg === undefined ? '-' : `${sale.quantityKg.toLocaleString()} kg`}</td><td>${escapeHtml(formatCurrency(sale.unitPrice))}</td><td>${escapeHtml(sale.status)}</td><td><strong>${escapeHtml(formatCurrency(sale.totalAmount))}</strong></td></tr></tbody></table><div class="totals"><div><span>Subtotal</span><strong>${escapeHtml(formatCurrency(sale.totalAmount))}</strong></div><div class="grand"><span>Grand Total</span><strong>${escapeHtml(formatCurrency(sale.totalAmount))}</strong></div></div></section>
    ${sale.notes ? `<section class="section"><h2>Notes</h2><div class="notes">${escapeHtml(sale.notes)}</div></section>` : ''}
    <footer class="footer">Generated from Tea Business Sales Dashboard</footer>
  </body></html>`)
  printDocument.close()

  let hasPrinted = false
  const printFrame = () => {
    if (hasPrinted) return
    const frameWindow = frame.contentWindow
    if (!frameWindow) return
    hasPrinted = true
    frameWindow.focus()
    frameWindow.print()
  }

  frame.onload = printFrame
  window.setTimeout(printFrame, 250)
  window.setTimeout(() => frame.remove(), 60_000)
}
