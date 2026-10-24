import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

/** Keep existing action menus anchored while fitting short screens and browser zoom. */
export function useAnchoredMenu(root: RefObject<HTMLElement | null>, open: boolean, contentKey?: unknown) {
  const [style, setStyle] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const node = root.current, menu = node?.querySelector<HTMLElement>('[role="menu"]')
      if (!node || !menu) return
      const rect = node.getBoundingClientRect()
      const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
      const below = Math.max(0, window.innerHeight - rect.bottom - 12)
      const above = Math.max(0, rect.top - Math.max(headerBottom + 8, 8) - 6)
      const flip = below < Math.min(menu.scrollHeight, 420) && above > below
      setStyle({ top: flip ? 'auto' : 'calc(100% + 6px)', bottom: flip ? 'calc(100% + 6px)' : 'auto', maxHeight: Math.min(420, flip ? above : below), overflowY: 'auto', overscrollBehavior: 'contain' })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [root, open, contentKey])
  return style
}
