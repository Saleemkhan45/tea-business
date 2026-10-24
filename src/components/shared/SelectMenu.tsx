import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { useCloseOnEscape } from './useCloseOnEscape'
import './select-menu.css'

export type SelectMenuOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

type SelectMenuProps<T extends string> = {
  value: T
  options: Array<SelectMenuOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  searchable?: boolean
  inline?: boolean
  floating?: boolean
  disabled?: boolean
}

export function SelectMenu<T extends string>({ value, options, onChange, ariaLabel, className = '', searchable = false, inline = false, floating = false, disabled = false }: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  const visibleOptions = searchable ? options.filter(option => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) : options
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = Math.max(options.findIndex(option => option.value === value), 0)
  const selectedOption = options[selectedIndex]

  const closeMenu = useCallback(() => { setOpen(false); setSearch('') }, [])
  useCloseOnEscape(closeMenu, open)

  useEffect(() => {
    if (!open) return undefined

    function handleOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) closeMenu()
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [closeMenu, open])

  useLayoutEffect(() => {
    if (!floating || !open || disabled) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const desired = Math.min(popoverRef.current?.scrollHeight ?? 280, 280)
      const flip = below < desired && above > below
      const maxHeight = Math.max(0, Math.min(280, flip ? above : below))
      const width = Math.min(rect.width, window.innerWidth - 16)
      setPosition({ top: flip ? rect.top - Math.min(desired, maxHeight) - 6 : rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width, maxHeight })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [floating, open, disabled, search, visibleOptions.length])

  function openAndFocus(index = selectedIndex) {
    if (disabled) return
    setOpen(true)
    const focusIndex = options[index]?.disabled
      ? options.findIndex(option => !option.disabled)
      : index
    window.requestAnimationFrame(() => searchable ? searchRef.current?.focus() : itemRefs.current[Math.max(focusIndex, 0)]?.focus())
  }

  function selectOption(option: SelectMenuOption<T>) {
    if (option.disabled) return
    onChange(option.value)
    closeMenu()
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function moveFocus(currentIndex: number, direction: number) {
    for (let step = 1; step <= visibleOptions.length; step += 1) {
      const nextIndex = (currentIndex + (direction * step) + visibleOptions.length) % visibleOptions.length
      if (!visibleOptions[nextIndex]?.disabled) {
        itemRefs.current[nextIndex]?.focus()
        return
      }
    }
  }

  const popover = (
    <div ref={popoverRef} className={`select-menu-popover ${floating ? 'select-menu-floating' : ''}`} style={floating ? position : undefined}>
      {searchable && <input ref={searchRef} className="select-menu-search" type="search" aria-label={`Search ${ariaLabel.toLowerCase()}`} aria-controls={listId} placeholder="Type to search..." value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter') event.preventDefault()
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const index = event.key === 'ArrowDown' ? visibleOptions.findIndex(option => !option.disabled) : visibleOptions.findLastIndex(option => !option.disabled)
          if (index >= 0) itemRefs.current[index]?.focus()
        }
      }} />}
      <div id={listId} role="listbox" aria-label={ariaLabel}>
      {visibleOptions.length === 0 && <p role="status">No matching options.</p>}
      {visibleOptions.map((option, index) => <button
        ref={node => { itemRefs.current[index] = node }}
        type="button"
        role="option"
        aria-selected={option.value === value}
        aria-disabled={option.disabled || undefined}
        disabled={option.disabled}
        className={`select-menu-option ${option.value === value ? 'is-selected' : ''}`}
        key={option.value}
        onClick={() => selectOption(option)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveFocus(index, event.key === 'ArrowDown' ? 1 : -1)
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const index = event.key === 'Home' ? visibleOptions.findIndex(option => !option.disabled) : visibleOptions.findLastIndex(option => !option.disabled)
            if (index >= 0) itemRefs.current[index]?.focus()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            closeMenu()
            triggerRef.current?.focus()
          }
        }}
      ><span>{option.label}</span>{option.value === value && <Check size={15} aria-hidden="true" />}</button>)}
      </div>
    </div>
  )

  return <div ref={rootRef} className={`select-menu ${open ? 'is-open' : ''} ${inline ? 'select-menu-inline' : ''} ${className}`.trim()} onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
      triggerRef.current?.focus()
    }
  }}>
    <button
      ref={triggerRef}
      type="button"
      className="select-menu-trigger"
      aria-label={`${ariaLabel}: ${selectedOption?.label ?? value}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      disabled={disabled}
      onClick={() => open ? closeMenu() : openAndFocus()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          openAndFocus(event.key === 'ArrowDown' ? selectedIndex : Math.max(selectedIndex - 1, 0))
        }
      }}
    ><span>{selectedOption?.label ?? value}</span><ChevronDown size={14} aria-hidden="true" /></button>
    {open && !disabled && (floating && typeof document !== 'undefined' ? createPortal(popover, document.body) : popover)}
  </div>
}
