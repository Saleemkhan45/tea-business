import type { BusinessDate, DateRange, IsoTimestamp } from '../domain/types'

export const PAKISTAN_TIME_ZONE = 'Asia/Karachi'
const PAKISTAN_UTC_OFFSET_MS = 5 * 60 * 60 * 1000
const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function getDateParts(value: BusinessDate) {
  const match = BUSINESS_DATE_PATTERN.exec(value)
  if (!match) throw new RangeError(`Invalid business date '${value}'. Expected YYYY-MM-DD.`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const validationDate = new Date(Date.UTC(year, month - 1, day))
  if (validationDate.getUTCFullYear() !== year || validationDate.getUTCMonth() !== month - 1 || validationDate.getUTCDate() !== day) {
    throw new RangeError(`Invalid business date '${value}'.`)
  }
  return { year, month, day }
}

export function isValidBusinessDate(value: string): value is BusinessDate {
  try {
    getDateParts(value)
    return true
  } catch {
    return false
  }
}

export function getPakistanBusinessDate(now = new Date()): BusinessDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PAKISTAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getCurrentTimestamp(now = new Date()): IsoTimestamp {
  return now.toISOString()
}

export function startOfDay(value: BusinessDate): Date {
  const { year, month, day } = getDateParts(value)
  return new Date(Date.UTC(year, month - 1, day) - PAKISTAN_UTC_OFFSET_MS)
}

export function endOfDay(value: BusinessDate): Date {
  return new Date(startOfDay(value).getTime() + 86_400_000 - 1)
}

export function shiftBusinessDate(value: BusinessDate, days: number): BusinessDate {
  const { year, month, day } = getDateParts(value)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

export function isToday(value: BusinessDate, now = new Date()): boolean {
  return value === getPakistanBusinessDate(now)
}

export function isWithinDateRange(value: BusinessDate, range: DateRange): boolean {
  getDateParts(value)
  getDateParts(range.startDate)
  getDateParts(range.endDate)
  if (range.startDate > range.endDate) throw new RangeError('Date range start must be on or before its end.')
  return value >= range.startDate && value <= range.endDate
}

export function formatBusinessDate(value: BusinessDate, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: PAKISTAN_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(startOfDay(value))
}
