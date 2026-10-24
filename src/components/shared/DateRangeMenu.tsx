import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SalesPeriod } from '../../features/dashboard'
import { Button } from './Button'
import { useCloseOnEscape } from './useCloseOnEscape'
import { navigateActionMenu } from './menuNavigation'
import { useAnchoredMenu } from './useAnchoredMenu'

export type DateRangeKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom'

export type DateRangeValue = {
  key: DateRangeKey
  label: string
  buttonLabel: string
  startDate: string
  endDate: string
  dayCount: number
  chartPeriod: SalesPeriod
}

const RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom Range' },
]

function toDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftDate(value: string, days: number) {
  const date = toDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateString(date)
}

function formatDate(value: string) {
  const date = toDate(value)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`
}

function countDays(startDate: string, endDate: string) {
  return Math.max(Math.round((toDate(endDate).getTime() - toDate(startDate).getTime()) / 86_400_000) + 1, 1)
}

export function getPakistanToday() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function createDateRange(key: DateRangeKey, customStart?: string, customEnd?: string): DateRangeValue {
  const today = getPakistanToday()
  const todayDate = toDate(today)
  let startDate = today
  let endDate = today
  let label = 'Today'

  if (key === 'yesterday') {
    startDate = shiftDate(today, -1)
    endDate = startDate
    label = 'Yesterday'
  } else if (key === 'last7') {
    startDate = shiftDate(today, -6)
    label = 'Last 7 Days'
  } else if (key === 'thisMonth') {
    startDate = `${today.slice(0, 8)}01`
    label = 'This Month'
  } else if (key === 'lastMonth') {
    const firstOfThisMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1))
    const firstOfLastMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 1, 1))
    startDate = toDateString(firstOfLastMonth)
    endDate = toDateString(new Date(firstOfThisMonth.getTime() - 86_400_000))
    label = 'Last Month'
  } else if (key === 'custom' && customStart && customEnd) {
    startDate = customStart
    endDate = customEnd
    label = 'Custom Range'
  }

  const dayCount = countDays(startDate, endDate)
  const chartPeriod: SalesPeriod = dayCount <= 1 ? 'Daily' : dayCount <= 7 ? 'Weekly' : dayCount > 365 ? 'Yearly' : 'Monthly'
  const buttonLabel = dayCount === 1
    ? `${key === 'today' ? 'Daily' : label} - ${formatDate(startDate)}`
    : `${formatDate(startDate)} - ${formatDate(endDate)}`

  return { key, label, buttonLabel, startDate, endDate, dayCount, chartPeriod }
}

export function getDefaultDateRange() {
  return createDateRange('today')
}

type DateRangeMenuProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}

export function DateRangeMenu({ value, onChange }: DateRangeMenuProps) {
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState(value.startDate)
  const [customEnd, setCustomEnd] = useState(value.endDate)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuStyle = useAnchoredMenu(rootRef, open, customOpen)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const today = getPakistanToday()

  const closeMenu = useCallback(() => {
    setOpen(false)
    setCustomOpen(false)
  }, [])

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelScheduledClose()
    closeTimerRef.current = window.setTimeout(closeMenu, 220)
  }, [cancelScheduledClose, closeMenu])

  useCloseOnEscape(closeMenu, open)

  useEffect(() => {
    if (!open) return undefined
    function handleOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu()
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [closeMenu, open])

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose])

  function selectPreset(key: DateRangeKey) {
    if (key === 'custom') {
      setCustomStart(value.startDate)
      setCustomEnd(value.endDate)
      setCustomOpen(true)
      return
    }
    onChange(createDateRange(key))
    closeMenu()
  }

  function applyCustomRange() {
    if (!customStart || !customEnd || customStart > customEnd) return
    onChange(createDateRange('custom', customStart, customEnd))
    closeMenu()
  }

  return <div
    ref={rootRef}
    className="date-range-menu"
    onKeyDown={event => navigateActionMenu(event, closeMenu)}
    onMouseEnter={() => {
      cancelScheduledClose()
      setOpen(true)
    }}
    onMouseLeave={scheduleClose}
    onFocusCapture={() => {
      cancelScheduledClose()
    }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose()
    }}
  >
    <Button
      className="date-button date-range-trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          window.requestAnimationFrame(() => firstItemRef.current?.focus())
        }
      }}
    ><CalendarDays size={16} /><span>{value.buttonLabel}</span><ChevronDown className={open ? 'is-open' : ''} size={14} /></Button>
    {open && <div className="date-range-popover" style={menuStyle} role="menu" aria-label="Dashboard date range">
      {RANGE_OPTIONS.map((option, index) => <button type="button"
        ref={index === 0 ? firstItemRef : undefined}
        key={option.key}
        role="menuitemradio"
        aria-checked={value.key === option.key}
        className={`date-range-option ${value.key === option.key ? 'active' : ''}`}
        onClick={() => selectPreset(option.key)}
      ><span>{option.label}</span>{value.key === option.key && <Check size={14} />}</button>)}
      {customOpen && <div className="custom-range-fields" role="group" aria-label="Custom date range">
        <label>From<input type="date" max={today} value={customStart} onChange={event => setCustomStart(event.target.value)} /></label>
        <label>To<input type="date" min={customStart} max={today} value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label>
        <button type="button" className="custom-range-apply" disabled={!customStart || !customEnd || customStart > customEnd} onClick={applyCustomRange}>Apply Range</button>
      </div>}
    </div>}
  </div>
}
