import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaymentCalendarBucket } from '../../../business/domain/customer-ledger.types'
import type { BusinessDate } from '../../../business/domain/types'
import { formatBusinessDate } from '../../../business/utils/date'
import { formatPKR } from '../../../business/utils/formatters'
import { Panel, StateBlock } from '../../../components/shared'
import { calendarCells } from '../utils/customerLedgerUi'

type Props = { buckets?: PaymentCalendarBucket[]; from: BusinessDate; to: BusinessDate; today: BusinessDate; isPending: boolean; isError: boolean; onPrevious: () => void; onNext: () => void; onRetry: () => void }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CustomerPaymentCalendar({ buckets, from, to, today, isPending, isError, onPrevious, onNext, onRetry }: Props) {
  const cells = calendarCells(to, from, to, buckets ?? [])
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${to.slice(0, 7)}-01T00:00:00Z`))

  return <Panel className="customer-calendar-panel" aria-label="Payment calendar">
    <div className="customer-section-heading"><div><h2>Payment calendar</h2><p>Daily collection activity</p></div><div className="customer-calendar-nav"><button type="button" onClick={onPrevious} aria-label="Previous month" title="Previous month"><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" onClick={onNext} disabled={to.slice(0, 7) >= today.slice(0, 7)} aria-label="Next month" title="Next month"><ChevronRight size={17} /></button></div></div>
    {isPending ? <StateBlock variant="loading" title="Loading payment calendar" message="Preparing daily activity." />
      : isError ? <StateBlock variant="error" title="Calendar unavailable" message="Try loading payment activity again." action={<button className="text-link" type="button" onClick={onRetry}>Retry</button>} />
        : !buckets?.length ? <StateBlock title="No calendar data" message="Choose another period to view payment activity." />
          : <div className="customer-calendar-grid" role="grid" aria-label={`${monthLabel} payment calendar`}>
            {WEEKDAYS.map(day => <span className="customer-calendar-weekday" key={day} role="columnheader">{day}</span>)}
            {cells.map(cell => {
              const level = cell.inRange && cell.bucket ? cell.bucket.level : 'no_data'
              const amount = cell.inRange && cell.bucket ? cell.bucket.amountPkr : null
              const label = `${formatBusinessDate(cell.date)}: ${amount === null ? 'No data' : formatPKR(amount)}`
              return <div key={cell.date} className={`customer-calendar-cell level-${level} ${cell.inMonth ? '' : 'outside-month'}`} role="gridcell" aria-label={label} tabIndex={cell.inMonth ? 0 : -1} title={label}>
                <span>{cell.date.slice(8)}</span><small>{amount === null ? '' : amount === 0 ? 'No pay' : formatPKR(amount)}</small>
              </div>
            })}
          </div>}
    <div className="customer-calendar-legend" aria-label="Calendar intensity"><span className="level-none">No payment</span><span className="level-low">Low</span><span className="level-medium">Medium</span><span className="level-high">High</span><span className="level-no_data">No data</span></div>
  </Panel>
}
