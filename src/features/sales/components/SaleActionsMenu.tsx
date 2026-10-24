import { Ban, Download, Eye, FilePenLine, MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnEscape } from '../../../components/shared'
import type { SaleRecord } from '../types/sales'
import { downloadSalePdf } from '../utils/downloadSalePdf'

type SaleActionsMenuProps = {
  sale: SaleRecord
  onViewDetails: (sale: SaleRecord) => void
  onEdit: (sale: SaleRecord) => void
  onVoid: (sale: SaleRecord) => void
  busy: boolean
}

const MENU_WIDTH = 196
const MENU_GAP = 6

export function SaleActionsMenu({ sale, onViewDetails, onEdit, onVoid, busy }: SaleActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const closeMenu = useCallback(() => setOpen(false), [])
  useCloseOnEscape(closeMenu, open)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const estimatedHeight = 194
    const openAbove = rect.bottom + MENU_GAP + estimatedHeight > window.innerHeight
    setPosition({
      top: openAbove ? Math.max(MENU_GAP, rect.top - estimatedHeight - MENU_GAP) : rect.bottom + MENU_GAP,
      left: Math.min(window.innerWidth - MENU_WIDTH - MENU_GAP, Math.max(MENU_GAP, rect.right - MENU_WIDTH)),
    })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    updatePosition()

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu()
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [closeMenu, open, updatePosition])

  function openMenu(focusFirst = false) {
    updatePosition()
    setOpen(true)
    if (focusFirst) window.requestAnimationFrame(() => itemRefs.current[0]?.focus())
  }

  function runAction(action?: () => void) {
    closeMenu()
    action?.()
  }

  function moveFocus(index: number, direction: number) {
    const nextIndex = (index + direction + itemRefs.current.length) % itemRefs.current.length
    if (itemRefs.current[nextIndex]?.disabled) moveFocus(nextIndex, direction)
    else itemRefs.current[nextIndex]?.focus()
  }

  const actions = [
    { label: 'Sale Detail', icon: Eye, action: () => onViewDetails(sale), disabled: false },
    { label: 'Edit Sale', icon: FilePenLine, action: () => onEdit(sale), disabled: busy || sale.status === 'Voided' || !sale.source?.inventoryMovements.length },
    { label: 'Download PDF', icon: Download, action: () => downloadSalePdf(sale), disabled: false },
  ]

  return <div className="sale-actions">
    <button
      ref={triggerRef}
      type="button"
      className={`row-action ${open ? 'is-active' : ''}`}
      aria-label={`Actions for ${sale.customerName}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => open ? closeMenu() : openMenu()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openMenu(true)
        }
      }}
    ><MoreHorizontal size={17} /></button>
    {open && createPortal(<div ref={menuRef} className="sale-actions-menu" role="menu" aria-label={`Sale actions for ${sale.customerName}`} style={position}>
      {actions.map(({ label, icon: Icon, action, disabled }, index) => <button
        key={label}
        ref={node => { itemRefs.current[index] = node }}
        type="button"
        role="menuitem"
        disabled={disabled}
        title={label === 'Edit Sale' && disabled ? 'Sale cannot be edited' : label}
        className="sale-actions-item"
        onClick={() => runAction(action)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveFocus(index, event.key === 'ArrowDown' ? 1 : -1)
          }
        }}
      ><Icon size={16} /><span>{label}</span></button>)}
      <div className="sale-actions-divider" />
      <button ref={node => { itemRefs.current[actions.length] = node }} type="button" role="menuitem" className="sale-actions-item is-danger" disabled={busy || sale.status === 'Voided'} onClick={() => runAction(() => onVoid(sale))} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveFocus(actions.length, event.key === 'ArrowDown' ? 1 : -1)
        }
      }}><Ban size={16} /><span>Cancel Sale</span></button>
    </div>, document.body)}
  </div>
}
