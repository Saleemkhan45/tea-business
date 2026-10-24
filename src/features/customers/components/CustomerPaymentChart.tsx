import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyPaymentBucket } from '../../../business/domain/customer-ledger.types'
import type { BusinessDate } from '../../../business/domain/types'
import { formatBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Panel, StateBlock } from '../../../components/shared'
import { paymentChartData } from '../utils/customerLedgerUi'

type Props = { buckets?: DailyPaymentBucket[]; highestDate: BusinessDate | null; isPending: boolean; isError: boolean; onRetry: () => void }

export function CustomerPaymentChart({ buckets, highestDate, isPending, isError, onRetry }: Props) {
  const data = paymentChartData(buckets ?? [], highestDate)

  return <Panel className="customer-chart-panel" aria-label="Daily payments chart">
    <div className="customer-section-heading"><div><h2>Daily payments</h2><p>Payment amount by business date</p></div><div className="customer-chart-legend"><span>Payment</span><span>Highest day</span><span>No payment</span></div></div>
    {isPending ? <StateBlock variant="loading" title="Loading daily payments" message="Preparing this period's chart." />
      : isError ? <StateBlock variant="error" title="Daily payments unavailable" message="Try loading the chart again." action={<button className="text-link" type="button" onClick={onRetry}>Retry</button>} />
        : data.length === 0 ? <StateBlock title="No daily payment data" message="Choose another period to view payment activity." />
          : <div className="customer-chart" role="img" aria-label={`Daily payments from ${formatBusinessDate(data[0].date)} to ${formatBusinessDate(data[data.length - 1].date)}. Zero-payment days are shown in red; the highest day is dark green.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date: BusinessDate) => date.slice(8)} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tickFormatter={(amount: number) => amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(amount)} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip labelFormatter={label => formatBusinessDate(String(label))} formatter={value => [formatPKR(Number(value)), 'Payment']} />
                <Bar dataKey="amountPkr" name="Payment" minPointSize={4} radius={[3, 3, 0, 0]}>{data.map(day => <Cell key={day.date} fill={day.isZero ? '#cf4d48' : day.isHighest ? '#137a52' : '#2f6fda'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
  </Panel>
}
