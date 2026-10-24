import { CircleDollarSign, Download, Eye, FilePenLine, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnEscape } from '../../../components/shared'
import type { PurchaseRecord } from '../types/purchases'
import { downloadPurchasePdf } from '../utils/downloadPurchasePdf'

type PurchaseActionsMenuProps = {
  purchase: PurchaseRecord
  onViewDetails: (purchase: PurchaseRecord) => void
  onEdit: (purchase: PurchaseRecord) => void
  onShowPayments: (purchase: PurchaseRecord) => void
  onCreatePayment: (purchase: PurchaseRecord) => void
  onDelete: (purchase: PurchaseRecord) => void
}

const MENU_WIDTH = 202
const MENU_GAP = 6

export function PurchaseActionsMenu({ purchase, onViewDetails, onEdit, onShowPayments, onCreatePayment, onDelete }: PurchaseActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setOpen(false), [])
  useCloseOnEscape(closeMenu, open)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const estimatedHeight = 286
    const openAbove = rect.bottom + MENU_GAP + estimatedHeight > window.innerHeight
    setPosition({
      top: openAbove ? Math.max(MENU_GAP, rect.top - estimatedHeight - MENU_GAP) : rect.bottom + MENU_GAP,
      left: Math.min(window.innerWidth - MENU_WIDTH - MENU_GAP, Math.max(MENU_GAP, rect.right - MENU_WIDTH)),
    })
  }, [purchase.status])

  useEffect(() => {
    if (!open) return undefined
    updatePosition()

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu()
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [closeMenu, open, updatePosition])

  function openMenu(focusFirst = false) {
    updatePosition()
    setOpen(true)
    if (focusFirst) window.requestAnimationFrame(() => firstItemRef.current?.focus())
  }

  function runAction(action: () => void) {
    action()
    closeMenu()
  }

  return <div className="purchase-row-actions">
    <button ref={triggerRef} type="button" className={`row-action ${open ? 'is-active' : ''}`} aria-label={`Actions for ${purchase.supplier} purchase`} aria-haspopup="menu" aria-expanded={open} onClick={() => open ? closeMenu() : openMenu()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openMenu(true)
      }
    }}><MoreHorizontal size={18} /></button>

    {open && createPortal(<div ref={menuRef} className="purchase-actions-menu" role="menu" aria-label={`Purchase actions for ${purchase.supplier}`} style={position}>
      <button ref={firstItemRef} type="button" role="menuitem" className="purchase-actions-item" onClick={() => runAction(() => onViewDetails(purchase))}><Eye size={16} /><span>Purchase Details</span></button>
      <button type="button" role="menuitem" className="purchase-actions-item" onClick={() => runAction(() => onEdit(purchase))}><FilePenLine size={16} /><span>Edit Purchase</span></button>
      <button type="button" role="menuitem" className="purchase-actions-item" onClick={() => runAction(() => onShowPayments(purchase))}><CircleDollarSign size={16} /><span>Show Payments</span></button>
      <button type="button" role="menuitem" className="purchase-actions-item" onClick={() => runAction(() => onCreatePayment(purchase))}><PlusCircle size={16} /><span>Create Payment</span></button>
      <button type="button" role="menuitem" className="purchase-actions-item" onClick={() => runAction(() => downloadPurchasePdf(purchase))}><Download size={16} /><span>Download PDF</span></button>
      <div className="purchase-actions-divider" />
      <button type="button" role="menuitem" className="purchase-actions-item is-danger" onClick={() => runAction(() => onDelete(purchase))}><Trash2 size={16} /><span>Delete purchase</span></button>
    </div>, document.body)}
  </div>
}
