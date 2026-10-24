import type { ReactNode } from 'react'

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral'
type BadgeProps = { tone?: BadgeTone; children: ReactNode; className?: string }

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`}>{children}</span>
}
