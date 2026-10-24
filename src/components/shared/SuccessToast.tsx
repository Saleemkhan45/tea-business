import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import './success-toast.css'

export function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null
  return <div className="operation-success-toast" role="status">
    <CheckCircle2 size={18} aria-hidden="true" />
    <span>{message}</span>
    <button type="button" onClick={onDismiss} aria-label="Dismiss success message" title="Dismiss"><X size={16} /></button>
  </div>
}
