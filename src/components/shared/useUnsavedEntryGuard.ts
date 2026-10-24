import { useEffect } from 'react'

export function useUnsavedEntryGuard(dirty: boolean, saving: boolean, uncertain = false) {
  function confirmLeave() {
    if (saving) return false
    if (!dirty && !uncertain) return true
    return window.confirm(uncertain
      ? 'This save has not been confirmed. Leaving discards the in-memory retry request. Check saved records before entering it again. Leave this form?'
      : 'Discard the unsaved changes in this form?')
  }
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!dirty && !saving && !uncertain) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const url = new URL(link.href)
      if (url.pathname === location.pathname && url.search === location.search) return
      if (!confirmLeave()) { event.preventDefault(); event.stopPropagation() }
    }
    let previousIndex = window.history.state?.idx as number | undefined
    let restoring = false
    const popstate = (event: PopStateEvent) => {
      const nextIndex = event.state?.idx as number | undefined
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return }
      if (previousIndex !== undefined && nextIndex !== undefined && !confirmLeave()) {
        event.stopImmediatePropagation(); restoring = true; window.history.go(previousIndex - nextIndex)
      } else previousIndex = nextIndex
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    window.addEventListener('popstate', popstate, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', popstate, true) }
  }, [dirty, saving, uncertain])
  return confirmLeave
}
