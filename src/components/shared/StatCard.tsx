import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from 'lucide-react'

type StatCardProps = { title: string; value: ReactNode; valueLabel?: string; detail?: string; change?: string; icon: LucideIcon; tone: 'blue' | 'orange' | 'green' | 'purple'; down?: boolean }

export function StatCard({ title, value, valueLabel, detail, change, icon: Icon, tone, down = false }: StatCardProps) {
  return <article className={`stat-card stat-card-${tone}`}><div className="stat-content"><div className="stat-value-row"><div className="stat-value">{valueLabel ? <><span aria-hidden="true">{value}</span><span className="sr-only">{valueLabel}</span></> : value}</div>{change && <div className={`stat-change ${down ? 'negative' : ''}`}>{down ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{change}</div>}</div><div className="stat-title">{title}<button type="button" aria-label={`${title} options`}><MoreHorizontal size={16} /></button></div>{detail && <small className="stat-detail">{detail}</small>}</div><div className={`stat-icon ${tone}`} aria-hidden="true"><Icon size={21} strokeWidth={2} /></div></article>
}


