import { useEffect } from 'react'

export const confirmCashDiscard = () => window.confirm('Discard the unsaved Cash Book changes?')

export function useCashDraftGuard(dirty: boolean, locked: boolean) {
  useEffect(() => {
    if (!dirty && !locked) return
    function leave() {
      if (locked) {
        window.alert('Resolve the pending save with Retry Same Request before leaving Cash Book.')
        return false
      }
      return confirmCashDiscard()
    }
    function linkClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const target = new URL(link.href)
      if (target.pathname === location.pathname && target.search === location.search) return
      if (!leave()) { event.preventDefault(); event.stopPropagation() }
    }
    // BrowserRouter exposes its history index. Restore a cancelled Back/Forward
    // before React Router receives the popstate; do not add synthetic history entries.
    let previousIndex = window.history.state?.idx as number | undefined
    let restoring = false
    function historyChange(event: PopStateEvent) {
      const nextIndex = event.state?.idx as number | undefined
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return }
      if (previousIndex !== undefined && nextIndex !== undefined && !leave()) {
        event.stopImmediatePropagation()
        restoring = true
        window.history.go(previousIndex - nextIndex)
      } else previousIndex = nextIndex
    }
    document.addEventListener('click', linkClick, true)
    window.addEventListener('popstate', historyChange, true)
    return () => { document.removeEventListener('click', linkClick, true); window.removeEventListener('popstate', historyChange, true) }
  }, [dirty, locked])
}
