import type { KeyboardEvent } from 'react'

/** Roving focus for the existing inline action menus; date inputs retain their native keys. */
export function navigateActionMenu(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.defaultPrevented) return
  const trigger = event.currentTarget.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
    trigger?.focus()
    return
  }
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemradio"]')]
  const index = items.indexOf(event.target as HTMLButtonElement)
  if (index < 0 || !items.length) return
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length : -1
  if (next >= 0) { event.preventDefault(); items[next].focus() }
}
