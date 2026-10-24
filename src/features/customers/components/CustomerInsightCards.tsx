import type { PaymentInsight } from '../../../business/domain/customer-ledger.types'
import { formatBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { StateBlock } from '../../../components/shared'
import { AnimatedValue } from './AnimatedValue'

type Props = { insight?: PaymentInsight; isPending: boolean; isError: boolean; onRetry: () => void }

export function CustomerInsightCards({ insight, isPending, isError, onRetry }: Props) {
  if (isPending) return <StateBlock variant="loading" title="Loading payment insights" message="Reviewing this period's payments." />
  if (isError) return <StateBlock variant="error" title="Payment insights unavailable" message="Try loading this period again." action={<button className="text-link" type="button" onClick={onRetry}>Retry</button>} />
  if (!insight) return <StateBlock title="No payment insights" message="No insight data is available for this period." />

  const cards = [
    { title: 'Highest payment day', value: insight.highestPaymentDay ? formatPKR(insight.highestPaymentDay.amountPkr) : 'No payments', detail: insight.highestPaymentDay ? formatBusinessDate(insight.highestPaymentDay.date) : 'No paid day in this period' },
    { title: 'Zero-payment days', value: <AnimatedValue value={insight.zeroPaymentDays} format="integer" />, detail: 'Days in selected range' },
    { title: 'Average daily payment', value: insight.averageDailyPaymentPkr === null ? 'Insufficient data' : <AnimatedValue value={insight.averageDailyPaymentPkr} />, detail: 'Across selected days' },
    { title: 'Estimated days to clear', value: insight.estimatedDaysToClear === null ? 'Insufficient data' : <AnimatedValue value={insight.estimatedDaysToClear} format="integer" />, detail: 'Based on payment pattern' },
  ]

  return <section className="customer-insights" aria-label="Payment insights">{cards.map(card => <article key={card.title} className="customer-insight"><span>{card.title}</span><strong>{card.value}</strong><small>{card.detail}</small></article>)}</section>
}
