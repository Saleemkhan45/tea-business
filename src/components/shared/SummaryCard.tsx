import type { ReactNode } from 'react'

type SummaryTone = 'blue' | 'green' | 'orange' | 'slate'

type SummaryCardProps = {
  title: string
  value: string
  detail: string
  tone?: SummaryTone
  icon?: ReactNode
}

export function SummaryCard({ title, value, detail, tone = 'blue', icon }: SummaryCardProps) {
  return <article className="summary-card">
    <span className={`summary-accent ${tone}`} aria-hidden="true" />
    {icon && <span className={`summary-icon ${tone}`} aria-hidden="true">{icon}</span>}
    <div className="summary-card-content">
      <span className="summary-title">{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </article>
}
