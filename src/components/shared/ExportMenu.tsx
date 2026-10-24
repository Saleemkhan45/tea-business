import { ChevronDown, FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { useCloseOnEscape } from './useCloseOnEscape'
import { navigateActionMenu } from './menuNavigation'
import { useAnchoredMenu } from './useAnchoredMenu'

type ExportMenuProps = {
  onExportPdf: () => void
  onExportExcel: () => void
  ariaLabel?: string
}

export function ExportMenu({ onExportPdf, onExportExcel, ariaLabel = 'Export data' }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuStyle = useAnchoredMenu(rootRef, open)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const closeMenu = useCallback(() => setOpen(false), [])

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelScheduledClose()
    closeTimerRef.current = window.setTimeout(closeMenu, 180)
  }, [cancelScheduledClose, closeMenu])

  useCloseOnEscape(closeMenu, open)

  useEffect(() => {
    if (!open) return undefined

    function handleOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu()
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [closeMenu, open])

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose])

  function openAndFocusMenu() {
    setOpen(true)
    window.requestAnimationFrame(() => firstItemRef.current?.focus())
  }

  function runExport(action: () => void) {
    action()
    closeMenu()
  }

  return <div
    ref={rootRef}
    className="export-menu"
    onKeyDown={event => navigateActionMenu(event, closeMenu)}
    onMouseEnter={() => {
      cancelScheduledClose()
      setOpen(true)
    }}
    onMouseLeave={scheduleClose}
    onFocusCapture={() => {
      cancelScheduledClose()
    }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose()
    }}
  >
    <Button
      className="export-menu-trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          openAndFocusMenu()
        }
      }}
    ><Upload size={16} /> Export <ChevronDown className={open ? 'is-open' : ''} size={14} /></Button>
    {open && <div className="export-menu-popover" style={menuStyle} role="menu" aria-label={ariaLabel}>
      <button ref={firstItemRef} type="button" role="menuitem" className="export-menu-item" onClick={() => runExport(onExportPdf)}><FileText size={17} /><span>Export as PDF</span></button>
      <button type="button" role="menuitem" className="export-menu-item" onClick={() => runExport(onExportExcel)}><FileSpreadsheet size={17} /><span>Export as Excel</span></button>
    </div>}
  </div>
}
