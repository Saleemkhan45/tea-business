import { Banknote, Clock3, PackageCheck, Scale } from 'lucide-react'
import type { CustomerSummary } from '../../../business/domain/customer-ledger.types'
import { formatBusinessDate } from '../../../business/utils/date'
import { AnimatedValue } from './AnimatedValue'

export function CustomerSummaryCards({ summary }: { summary: CustomerSummary }) {
  const cards = [
    { title: 'Current Khata', icon: Scale, value: <AnimatedValue value={summary.currentBalancePkr} />, detail: summary.currentBalancePkr < 0 ? 'Balance requires review' : 'Amount Due' },
    { title: "Today's Purchases", icon: Clock3, value: summary.todayPurchasedPkr === undefined ? '-' : <AnimatedValue value={summary.todayPurchasedPkr} />, detail: summary.lastPaymentDate ? `Last paid ${formatBusinessDate(summary.lastPaymentDate)}` : 'No payment yet' },
    { title: 'Paid Today', icon: Banknote, value: summary.todayPaidPkr === undefined ? '-' : <AnimatedValue value={summary.todayPaidPkr} />, detail: `Total received: PKR ${summary.totalPaidPkr.toLocaleString('en-PK')}` },
    { title: 'Total Purchases', icon: PackageCheck, value: <AnimatedValue value={summary.totalPurchasedPkr} />, detail: <AnimatedValue value={summary.totalPurchasedKg} format="kg" /> },
  ]

  return <section className="customer-metrics" aria-label="Account summary">
    {cards.map(({ title, icon: Icon, value, detail }) => <article className="customer-metric" key={title}>
      <div className="customer-metric-top"><span>{title}</span><Icon size={18} aria-hidden="true" /></div>
      <strong>{value}</strong><small>{detail}</small>
    </article>)}
  </section>
}
