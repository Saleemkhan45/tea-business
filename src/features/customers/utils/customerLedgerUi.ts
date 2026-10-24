import type { DailyPaymentBucket, PaymentCalendarBucket } from '../../../business/domain/customer-ledger.types'
import type { BusinessDate } from '../../../business/domain/types'
import { shiftBusinessDate } from '../../../business/utils/date'

export const formatLedgerQuantity = (value: number) => `${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 }).format(value)} kg`

export function paymentChartData(buckets: DailyPaymentBucket[], highestDate: BusinessDate | null) {
  return buckets.map(bucket => ({
    ...bucket,
    isHighest: bucket.amountPkr > 0 && bucket.date === highestDate,
    isZero: bucket.amountPkr === 0,
  }))
}

export function monthRange(date: BusinessDate, today: BusinessDate) {
  const [year, month] = date.split('-').map(Number)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { from, to: last > today ? today : last }
}

export function shiftMonth(date: BusinessDate, months: number): BusinessDate {
  const [year, month] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10)
}

export type CalendarCell = { date: BusinessDate; bucket: PaymentCalendarBucket | null; inRange: boolean; inMonth: boolean }

export function calendarCells(monthDate: BusinessDate, from: BusinessDate, to: BusinessDate, buckets: PaymentCalendarBucket[]): CalendarCell[] {
  const [year, month] = monthDate.split('-').map(Number)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const firstWeekday = new Date(`${monthStart}T00:00:00Z`).getUTCDay()
  const mondayOffset = (firstWeekday + 6) % 7
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cellCount = Math.ceil((mondayOffset + lastDay) / 7) * 7
  const bucketByDate = new Map(buckets.map(bucket => [bucket.date, bucket]))

  return Array.from({ length: cellCount }, (_, index) => {
    const date = shiftBusinessDate(monthStart, index - mondayOffset)
    return { date, bucket: bucketByDate.get(date) ?? null, inRange: date >= from && date <= to, inMonth: date.slice(0, 7) === monthStart.slice(0, 7) }
  })
}
