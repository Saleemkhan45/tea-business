import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import './confirmDialog.css'

type ConfirmDialogProps = {
  title: string
  message: ReactNode
  confirmLabel?: string
  error?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', error, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])

  return <div className="confirm-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} onKeyDown={event => { if (event.key === 'Escape' && !busy) onCancel() }}>
      <h2 id={titleId}>{title}</h2>
      <div className="confirm-dialog-message">{message}</div>
      {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions">
        <button ref={cancelRef} type="button" className="ui-button ui-button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <Button className="confirm-dialog-danger" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </section>
  </div>
}
