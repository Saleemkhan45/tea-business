import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '../../components/shared'

export function CashDialog({ title, onClose, locked = false, children, footer }: { title: string; onClose: () => void; locked?: boolean; children: ReactNode; footer?: ReactNode }) {
  const dialog = useRef<HTMLElement>(null), titleId = useId()
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  const content = <div className="cash-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} className="cash-dialog manual-details" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? [])].filter(node => node.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }}><header><h2 id={titleId}>{title}</h2><Button disabled={locked} onClick={onClose} aria-label={`Close ${title}`}><X size={18} aria-hidden="true" /></Button></header>
      <div className="cash-dialog-body">{children}</div>{footer && <footer>{footer}</footer>}
    </section>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
