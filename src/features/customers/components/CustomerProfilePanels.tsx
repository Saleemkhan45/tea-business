import { useState } from 'react'
import { Banknote, CalendarDays, FileText, PackageCheck, ReceiptText, Scale, Search } from 'lucide-react'
import type {
  CustomerLedgerTransaction,
  CustomerPaymentTransaction,
  CustomerPurchaseTransaction,
  CustomerSummary,
  LedgerRow,
} from '../../../business/domain/customer-ledger.types'
import { formatBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Badge, Button, Panel, StateBlock, Table, TableBody, TableHead } from '../../../components/shared'
import type { CustomerProfile } from '../../customer-ledger'
import { formatLedgerQuantity } from '../utils/customerLedgerUi'

type CustomerInformationPanelProps = {
  customer: CustomerProfile
}

type SummaryPanelProps = {
  summary: CustomerSummary
}

type PurchaseHistoryPanelProps = {
  transactions?: CustomerLedgerTransaction[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
}

const TEA_LABELS = {
  green: 'Green Tea',
  black: 'Black Tea',
  jasmine: 'Jasmine Tea',
  herbal: 'Herbal Blend',
  other: 'Other',
} as const
const RECORDED_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short',
})

function formatDateTime(value?: string) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatOptionalBusinessDate(value: string | null | undefined) {
  return value ? formatBusinessDate(value) : 'Not recorded'
}

function saleReference(transaction: CustomerPurchaseTransaction) {
  if (transaction.reference) return transaction.reference
  return transaction.saleId ? `SL-${transaction.saleId.slice(-6).toUpperCase()}` : '-'
}

function isPurchase(transaction: CustomerLedgerTransaction): transaction is CustomerPurchaseTransaction {
  return transaction.type === 'purchase'
}

function isSalePayment(transaction: CustomerLedgerTransaction): transaction is CustomerPaymentTransaction & { saleId: string } {
  return transaction.type === 'payment' && transaction.status === 'active' && Boolean(transaction.saleId)
}

function paymentStatus(totalPkr: number, paidPkr: number, cancelled: boolean) {
  if (cancelled) return 'Cancelled'
  if (paidPkr >= totalPkr) return 'Paid'
  if (paidPkr > 0) return 'Partial'
  return 'Khata'
}

export function CustomerInformationPanel({ customer }: CustomerInformationPanelProps) {
  return <Panel className="customer-profile-panel customer-info-panel" aria-label="Customer information">
    <div className="customer-section-heading"><div><h2>Customer Information</h2><p>Permanent customer profile</p></div><FileText size={18} aria-hidden="true" /></div>
    <dl className="customer-definition-grid">
      <div><dt>Name</dt><dd>{customer.name || 'Customer account'}</dd></div>
      <div><dt>Phone</dt><dd>{customer.phone || 'Not recorded'}</dd></div>
      <div><dt>Address</dt><dd>{customer.address || 'Not recorded'}</dd></div>
      <div><dt>Region</dt><dd>{customer.region || 'Not recorded'}</dd></div>
      <div><dt>City</dt><dd>{customer.city || 'Not recorded'}</dd></div>
      <div><dt>Customer since</dt><dd>{formatDateTime(customer.createdAt)}</dd></div>
      <div><dt>Status</dt><dd><Badge tone={customer.status === 'active' ? 'success' : 'warning'}>{customer.status === 'active' ? 'Active' : 'Inactive'}</Badge></dd></div>
      <div className="customer-definition-wide"><dt>Notes</dt><dd>{customer.notes || 'No notes recorded'}</dd></div>
    </dl>
  </Panel>
}

export function CustomerFinancialPanel({ summary }: SummaryPanelProps) {
  return <Panel className="customer-profile-panel customer-financial-panel" aria-label="Financial summary">
    <div className="customer-section-heading"><div><h2>Financial Summary</h2><p>Ledger-derived customer totals</p></div><Scale size={18} aria-hidden="true" /></div>
    <dl className="customer-financial-grid">
      <div><dt>Old Khata / Previous Due</dt><dd>{formatPKR(summary.openingBalancePkr ?? 0)}</dd></div>
      <div><dt>Total lifetime purchases</dt><dd>{formatPKR(summary.totalPurchasedPkr)}</dd></div>
      <div><dt>Total payments received</dt><dd>{formatPKR(summary.totalPaidPkr)}</dd></div>
      <div><dt>Current total Khata</dt><dd>{formatPKR(summary.currentBalancePkr)}</dd></div>
      <div><dt>Total due</dt><dd>{formatPKR(summary.currentBalancePkr)}</dd></div>
      <div><dt>Number of purchases</dt><dd>{summary.purchaseCount.toLocaleString('en-PK')}</dd></div>
      <div><dt>Last purchase date</dt><dd>{formatOptionalBusinessDate(summary.lastPurchaseDate)}</dd></div>
      <div><dt>Last payment date</dt><dd>{formatOptionalBusinessDate(summary.lastPaymentDate)}</dd></div>
    </dl>
  </Panel>
}

export function CustomerProductSummaryPanel({ summary }: SummaryPanelProps) {
  const productRows = summary.productSummary ?? []
  const greenKg = productRows.filter(row => row.teaType === 'green').reduce((total, row) => total + row.totalQuantityKg, 0)
  const blackKg = productRows.filter(row => row.teaType === 'black').reduce((total, row) => total + row.totalQuantityKg, 0)
  const otherKg = productRows
    .filter(row => row.teaType !== 'green' && row.teaType !== 'black')
    .reduce((total, row) => total + row.totalQuantityKg, 0)

  return <Panel className="customer-profile-panel customer-product-panel" aria-label="Product purchase summary">
    <div className="customer-section-heading"><div><h2>Product Purchase Summary</h2><p>Historical sale lines grouped by product</p></div><PackageCheck size={18} aria-hidden="true" /></div>
    <dl className="customer-product-kpis">
      <div><dt>Green Tea</dt><dd>{formatLedgerQuantity(greenKg)}</dd></div>
      <div><dt>Black Tea</dt><dd>{formatLedgerQuantity(blackKg)}</dd></div>
      <div><dt>Other products</dt><dd>{formatLedgerQuantity(otherKg)}</dd></div>
      <div><dt>Total quantity</dt><dd>{formatLedgerQuantity(summary.totalPurchasedKg)}</dd></div>
    </dl>
    {productRows.length === 0 ? <StateBlock title="No product purchases" message="Recorded sale lines will appear here." />
      : <Table className="customer-product-table"><caption className="sr-only">Product purchase summary</caption><TableHead><tr><th scope="col">Product</th><th scope="col">Tea type</th><th scope="col">Quantity</th><th scope="col">Spending</th><th scope="col">Purchases</th><th scope="col">Last purchase</th></tr></TableHead><TableBody>{productRows.map(row => <tr key={`${row.teaType ?? 'other'}-${row.productName}`}>
        <td><strong>{row.productName}</strong></td>
        <td>{row.teaType ? TEA_LABELS[row.teaType] ?? row.teaType : 'Other'}</td>
        <td>{formatLedgerQuantity(row.totalQuantityKg)}</td>
        <td>{formatPKR(row.totalSpendingPkr)}</td>
        <td>{row.purchaseCount.toLocaleString('en-PK')}</td>
        <td>{formatOptionalBusinessDate(row.lastPurchaseDate)}</td>
      </tr>)}</TableBody></Table>}
  </Panel>
}

export function CustomerPurchaseHistoryPanel({ transactions, isPending, isError, onRetry }: PurchaseHistoryPanelProps) {
  const [search, setSearch] = useState('')
  const reversed = new Set((transactions ?? [])
    .filter(transaction => transaction.status === 'active' && transaction.reversalOf)
    .map(transaction => transaction.reversalOf))
  const paymentsBySale = new Map<string, number>()
  for (const transaction of transactions ?? []) {
    if (!isSalePayment(transaction) || reversed.has(transaction.id)) continue
    paymentsBySale.set(transaction.saleId, (paymentsBySale.get(transaction.saleId) ?? 0) + transaction.amountPkr)
  }
  const purchases = (transactions ?? []).filter(isPurchase).filter(purchase =>
    [purchase.productName, purchase.teaType, saleReference(purchase), purchase.enteredByName]
      .some(value => value?.toLowerCase().includes(search.trim().toLowerCase())))

  return <Panel className="customer-profile-panel customer-purchase-panel" aria-label="Customer purchase history">
    <div className="customer-section-heading"><div><h2>Purchase History</h2><p>Sale charges linked to this account</p></div><ReceiptText size={18} aria-hidden="true" /></div>
    <label className="customer-history-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search purchase history</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product, reference or operator" /></label>
    {isPending ? <StateBlock variant="loading" title="Loading purchase history" message="Fetching sale-linked ledger records." />
      : isError ? <StateBlock variant="error" title="Purchase history unavailable" message="Try loading purchases again." action={<Button onClick={onRetry}>Retry</Button>} />
        : purchases.length === 0 ? <StateBlock icon={<CalendarDays size={22} />} title="No purchases recorded" message="Customer sales will appear here after they are saved." />
          : <Table className="customer-purchase-table"><caption className="sr-only">Customer purchase history</caption><TableHead><tr><th scope="col">Sale date</th><th scope="col">Reference</th><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Total</th><th scope="col">Paid at sale</th><th scope="col">Sale due</th><th scope="col">Payment status</th><th scope="col">Operator</th></tr></TableHead><TableBody>{purchases.map(purchase => {
            const cancelled = purchase.status === 'voided' || reversed.has(purchase.id)
            const paidPkr = paymentsBySale.get(purchase.saleId) ?? 0
            const duePkr = Math.max(0, purchase.amountPkr - paidPkr)
            const status = paymentStatus(purchase.amountPkr, paidPkr, cancelled)
            return <tr key={purchase.id} className={cancelled ? 'is-voided' : ''}>
              <td>{formatBusinessDate(purchase.businessDate)}</td>
              <td><details className="customer-sale-details"><summary>{saleReference(purchase)}</summary><dl><dt>Sale ID</dt><dd>{purchase.saleId}</dd><dt>Recorded</dt><dd>{RECORDED_DATE_FORMAT.format(new Date(purchase.createdAt))}</dd><dt>Notes</dt><dd>{purchase.notes || 'No notes recorded'}</dd>{purchase.status === 'voided' && <><dt>Void reason</dt><dd>{purchase.voidReason}</dd></>}</dl></details></td>
              <td><strong>{purchase.productName ?? (purchase.teaType ? TEA_LABELS[purchase.teaType] : 'Tea product')}</strong></td>
              <td>{formatLedgerQuantity(purchase.quantityKg)}</td>
              <td>{formatPKR(purchase.ratePerKgPkr)}</td>
              <td>{formatPKR(purchase.amountPkr)}</td>
              <td>{cancelled ? '-' : formatPKR(paidPkr)}</td>
              <td>{cancelled ? '-' : formatPKR(duePkr)}</td>
              <td><Badge tone={status === 'Paid' ? 'success' : status === 'Partial' ? 'warning' : status === 'Cancelled' ? 'danger' : 'neutral'}>{status}</Badge></td>
              <td>{purchase.enteredByName ?? '-'}</td>
            </tr>
          })}</TableBody></Table>}
  </Panel>
}

export function CustomerPaymentHistoryPanel({ transactions, isPending, isError, onRetry }: PurchaseHistoryPanelProps) {
  const payments = (transactions ?? []).filter((transaction): transaction is CustomerPaymentTransaction => transaction.type === 'payment')

  return <Panel className="customer-profile-panel customer-payment-history-panel" aria-label="Customer payment history">
    <div className="customer-section-heading"><div><h2>Payment History</h2><p>Receipts recorded against this customer account</p></div><Banknote size={18} aria-hidden="true" /></div>
    {isPending ? <StateBlock variant="loading" title="Loading payment history" message="Fetching customer payment records." />
      : isError ? <StateBlock variant="error" title="Payment history unavailable" message="Try loading payments again." action={<Button onClick={onRetry}>Retry</Button>} />
        : payments.length === 0 ? <StateBlock title="No payments recorded" message="Customer receipts will appear here after payment is recorded." />
          : <Table className="customer-payment-history-table"><caption className="sr-only">Customer payment history</caption><TableHead><tr><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Reference</th><th scope="col">Source</th><th scope="col">Entered By</th><th scope="col">Status</th></tr></TableHead><TableBody>{payments.map(payment => <tr key={payment.id} className={payment.status === 'voided' ? 'is-voided' : ''}>
            <td>{formatBusinessDate(payment.businessDate)}</td>
            <td><strong>{formatPKR(payment.amountPkr)}</strong></td>
            <td>{payment.paymentMethod.replace('_', ' ')}</td>
            <td>{payment.reference || '-'}</td>
            <td>{payment.saleId ? `Sale ${payment.saleId.slice(-6).toUpperCase()}` : 'Account payment'}</td>
            <td>{payment.enteredByName ?? '-'}</td>
            <td><Badge tone={payment.status === 'active' ? 'success' : 'danger'}>{payment.status === 'active' ? 'Active' : 'Voided'}</Badge></td>
          </tr>)}</TableBody></Table>}
  </Panel>
}

type PeriodPanelProps = PurchaseHistoryPanelProps & {
  rows?: LedgerRow[]
  from: string
  to: string
}

export function CustomerPeriodPanel({ transactions, rows, from, to, isPending, isError, onRetry }: PeriodPanelProps) {
  const reversed = new Set((transactions ?? []).filter(transaction =>
    transaction.status === 'active' && transaction.reversalOf).map(transaction => transaction.reversalOf))
  const period = (transactions ?? []).filter(transaction => transaction.status === 'active'
    && !reversed.has(transaction.id) && transaction.businessDate >= from && transaction.businessDate <= to)
  const purchases = period.filter(isPurchase)
  const totalPurchases = purchases.reduce((total, purchase) => total + purchase.amountPkr, 0)
  const payments = period.filter(transaction => transaction.type === 'payment')
    .reduce((total, payment) => total + payment.amountPkr, 0)
  const balance = (rows ?? []).filter(row => row.businessDate <= to).at(-1)?.runningBalancePkr ?? 0
  const products = new Map<string, number>()
  for (const purchase of purchases) {
    const name = purchase.productName || TEA_LABELS[purchase.teaType] || 'Tea product'
    products.set(name, (products.get(name) ?? 0) + purchase.quantityKg)
  }

  return <Panel className="customer-profile-panel" aria-label="Customer period statement">
    <div className="customer-section-heading"><div><h2>Period Statement</h2><p>{formatBusinessDate(from)} to {formatBusinessDate(to)}</p></div><FileText size={18} aria-hidden="true" /></div>
    {isPending ? <StateBlock variant="loading" title="Loading statement" message="Fetching customer transactions." />
      : isError ? <StateBlock variant="error" title="Statement unavailable" message="Try loading the customer statement again." action={<Button onClick={onRetry}>Retry</Button>} />
        : <><dl className="customer-financial-grid"><div><dt>Period purchases</dt><dd>{formatPKR(totalPurchases)}</dd></div><div><dt>Period payments received</dt><dd>{formatPKR(payments)}</dd></div><div><dt>Khata through {formatBusinessDate(to)}</dt><dd>{formatPKR(balance)}</dd></div><div><dt>Purchases</dt><dd>{purchases.length}</dd></div></dl>
          {products.size > 0 && <Table className="customer-period-products"><caption className="sr-only">Product quantities in selected period</caption><TableHead><tr><th scope="col">Product</th><th scope="col">Quantity</th></tr></TableHead><TableBody>{[...products].map(([name, quantity]) => <tr key={name}><td>{name}</td><td>{formatLedgerQuantity(quantity)}</td></tr>)}</TableBody></Table>}
        </>}
  </Panel>
}
