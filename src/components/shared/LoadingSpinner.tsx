import { TailChase } from 'ldrs/react'
import 'ldrs/react/TailChase.css'
import './loading.css'

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showLabel?: boolean
  decorative?: boolean
  className?: string
}

export function LoadingSpinner({ size = 'md', label = 'Loading...', showLabel = false, decorative = false, className = '' }: LoadingSpinnerProps) {
  return <span className={`loading-spinner loading-spinner-${size} ${className}`} role={decorative ? undefined : 'status'} aria-live={decorative ? undefined : 'polite'} aria-hidden={decorative || undefined}>
    <span className="loading-spinner-visual" aria-hidden="true"><TailChase size={{ sm: 20, md: 28, lg: 40 }[size]} speed={1.75} color="currentColor" /></span>
    {!decorative && <span className={showLabel ? 'loading-spinner-label' : 'sr-only'}>{label}</span>}
  </span>
}
