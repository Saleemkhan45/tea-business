import type { PurchaseRecord } from '../types/purchases'

const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${value}T00:00:00`))
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function downloadPurchasePdf(purchase: PurchaseRecord) {
  const subtotal = purchase.quantityKg * purchase.costPerKg
  const paid = purchase.paidAmount ?? 0
  const due = Math.max(purchase.totalCost - paid, 0)
  const paymentStatus = due === 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid'
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) return frame.remove()

  doc.open()
  doc.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Purchase No. ${purchase.purchaseNumber}</title>
        <style>
          @page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#26364d;font:11px Arial,sans-serif}.head{display:flex;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #0878dd}.head h1{margin:0;font-size:22px}.head p{margin:4px 0 0}.head div:last-child{text-align:right;color:#64748b}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.grid div,.pay div{padding:10px;background:#f5f8fb;border:1px solid #dce4ed}.grid span,.pay span{display:block;color:#7b899c;font-size:8px;text-transform:uppercase}.grid strong,.pay strong{display:block;margin-top:5px}h2{margin:20px 0 9px;color:#173b60;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #dce4ed;text-align:left}th{background:#eef3f7;font-size:9px}.summary{width:48%;margin:14px 0 0 auto;border:1px solid #dce4ed}.summary div{display:flex;justify-content:space-between;padding:8px 10px;border-top:1px solid #e4eaf0}.summary div:first-child{border-top:0}.summary .grand{color:#0878dd;background:#f4f8fc;font-weight:bold}.pay{display:grid;grid-template-columns:repeat(4,1fr)}.notes{padding:11px;border-left:3px solid #0878dd;background:#f8fafc;line-height:1.5}.foot{margin-top:26px;padding-top:9px;border-top:1px solid #dce4ed;color:#8b98a9;font-size:8px;text-align:center}
        </style>
      </head>
      <body>
        <header class="head"><div><h1>Tea Business</h1><p>Purchase order and payment record</p></div><div><strong>Purchase No. ${purchase.purchaseNumber}</strong><p>${escape(formatDate(purchase.date))}</p><p>${escape(purchase.status)}</p></div></header>
        <div class="grid"><div><span>Purchase No.</span><strong>${purchase.purchaseNumber}</strong></div><div><span>Supplier Name</span><strong>${escape(purchase.supplier)}</strong></div><div><span>Purchase Date</span><strong>${escape(formatDate(purchase.date))}</strong></div><div><span>Purchase Region</span><strong>${escape(purchase.region)}</strong></div></div>
        <h2>Purchase Items</h2>
        <table><thead><tr><th>Product</th><th>Quantity (kg)</th><th>Unit Price (PKR)</th><th>Discount</th><th>Tax</th><th>Unit Cost</th><th>Total Cost</th></tr></thead><tbody><tr><td>${escape(purchase.teaType)}</td><td>${purchase.quantityKg.toLocaleString()} kg</td><td>${escape(money(purchase.costPerKg))}</td><td>${escape(money(purchase.discountAmount))}</td><td>${escape(money(purchase.taxAmount))}</td><td>${escape(money(purchase.costPerKg))}</td><td><strong>${escape(money(purchase.totalCost))}</strong></td></tr></tbody></table>
        <div class="summary"><div><span>Subtotal</span><strong>${escape(money(subtotal))}</strong></div><div><span>Order Tax</span><strong>${escape(money(purchase.taxAmount))}</strong></div><div><span>Discount</span><strong>- ${escape(money(purchase.discountAmount))}</strong></div><div><span>Shipping</span><strong>${escape(money(purchase.shippingAmount))}</strong></div><div class="grand"><span>Grand Total</span><strong>${escape(money(purchase.totalCost))}</strong></div></div>
        <h2>Payment Summary</h2>
        <div class="pay"><div><span>Payment Status</span><strong>${paymentStatus}</strong></div><div><span>Amount Paid</span><strong>${escape(money(paid))}</strong></div><div><span>Balance Due</span><strong>${escape(money(due))}</strong></div><div><span>Payment Method</span><strong>${escape(purchase.paymentMethod ?? 'Not recorded')}</strong></div></div>
        <h2>Description</h2><div class="notes">${escape(purchase.notes ?? 'No description provided.')}</div>
        <footer class="foot">Generated from Tea Business Purchases Dashboard</footer>
      </body>
    </html>`)
  doc.close()

  let printed = false
  const print = () => {
    if (printed || !frame.contentWindow) return
    printed = true
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }
  frame.onload = print
  window.setTimeout(print, 250)
  window.setTimeout(() => frame.remove(), 60_000)
}
