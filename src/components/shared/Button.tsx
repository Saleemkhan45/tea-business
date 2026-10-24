import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
  loading?: boolean
}

export function Button({ variant = 'secondary', className = '', children, loading = false, disabled, ...props }: ButtonProps) {
  return <button type="button" className={`ui-button ui-button-${variant} ${className}`} {...props} disabled={disabled || loading} aria-busy={loading || undefined}>{loading && <LoadingSpinner size="sm" decorative />}{children}</button>
}
