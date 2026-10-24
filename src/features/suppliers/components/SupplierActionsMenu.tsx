import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export function SupplierActionsMenu({ name, status, canManage, onAction }: { name: string; status: 'active' | 'inactive'; canManage: boolean; onAction: (action: 'view' | 'edit' | 'purchases' | 'status') => void }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!position) return
    menu.current?.querySelector('button')?.focus()
    const close = () => setPosition(null)
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside); window.addEventListener('scroll', close, true); window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [position])
  function open() {
    const rect = trigger.current?.getBoundingClientRect()
    if (rect) setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 190)), left: Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)) })
  }
  return <><button className="row-action" type="button" ref={trigger} aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={Boolean(position)} onClick={() => position ? setPosition(null) : open()} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); open() } }}><MoreHorizontal size={18} /></button>{position && createPortal(<div className="supplier-actions-menu" ref={menu} role="menu" aria-label={`Actions for ${name}`} style={position} onKeyDown={event => {
    const buttons = Array.from(menu.current?.querySelectorAll('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape' || event.key === 'Tab') { setPosition(null); if (event.key === 'Escape') { event.preventDefault(); trigger.current?.focus() } }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus() }
  }}>{([['view', 'View Supplier'], ['edit', 'Edit Supplier'], ['purchases', 'Purchase History'], ['status', status === 'active' ? 'Deactivate Supplier' : 'Activate Supplier']] as const).filter(([action]) => canManage || action === 'view' || action === 'purchases').map(([action, label]) => <button type="button" role="menuitem" key={action} onClick={() => { setPosition(null); trigger.current?.focus(); onAction(action) }}>{label}</button>)}</div>, document.body)}</>
}


