import type { ReactNode } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

type StateBlockVariant = 'empty' | 'loading' | 'error'

type StateBlockProps = {
  title: string
  message: string
  variant?: StateBlockVariant
  icon?: ReactNode
  action?: ReactNode
}

const defaultIcons: Record<StateBlockVariant, ReactNode> = {
  empty: <Search size={21} />,
  loading: <LoadingSpinner size="md" decorative />,
  error: <AlertCircle size={21} />,
}

export function StateBlock({ title, message, variant = 'empty', icon, action }: StateBlockProps) {
  return <div className={`state-block state-block-${variant}`} role={variant === 'error' ? 'alert' : 'status'} aria-live="polite">
    <div className="state-block-icon">{icon ?? defaultIcons[variant]}</div>
    <strong>{title}</strong>
    <p>{message}</p>
    {action}
  </div>
}
