export type RevenuePeriod = 'Daily' | 'Weekly' | 'Monthly'

// Business dates are calendar strings in Karachi, not instants to shift by timezone.
export function revenueRange(anchor: string, period: RevenuePeriod) {
  const start = new Date(`${anchor}T00:00:00Z`)
  const end = new Date(start)
  if (period === 'Weekly') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
    end.setTime(start.getTime())
    end.setUTCDate(end.getUTCDate() + 6)
  } else if (period === 'Monthly') {
    start.setUTCDate(1)
    end.setUTCMonth(end.getUTCMonth() + 1, 0)
  }
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export function revenueDate(date: string, weekday = false) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...(weekday ? { weekday: 'short' as const } : { day: 'numeric' as const, month: 'short' as const }) }).format(new Date(`${date}T00:00:00Z`))
}
