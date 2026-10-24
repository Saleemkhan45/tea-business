import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import './navigation.css'
import { RouteContent } from '../components/shared/RouteContent'
import { trapNavigationTab } from './navigationFocus'

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('tea-business.sidebar-collapsed') === 'true' }
    catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const sidebarRef = useRef<HTMLElement>(null)
  const closeNavigation = useCallback(() => setMobileOpen(false), [])
  const location = useLocation()

  useEffect(() => {
    try { localStorage.setItem('tea-business.sidebar-collapsed', String(collapsed)) }
    catch { /* Navigation remains usable when storage is unavailable. */ }
  }, [collapsed])

  useEffect(closeNavigation, [location.pathname, closeNavigation])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const update = () => { setIsMobile(media.matches); if (!media.matches) closeNavigation() }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [closeNavigation])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? [])].filter(node => node.getClientRects().length > 0)
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus({ preventScroll: true }))
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeNavigation() }
      trapNavigationTab(event, focusable(), document.activeElement)
    }
    function containFocus(event: FocusEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) focusable()[0]?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [mobileOpen, closeNavigation])

  return <div className="app-shell"><Sidebar sidebarRef={sidebarRef} mobile={isMobile} collapsed={!isMobile && collapsed} open={mobileOpen} onToggleCollapse={() => setCollapsed(value => !value)} onClose={closeNavigation} /><div className="main-shell" inert={mobileOpen}><Header onMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} /><main id="main-content"><RouteContent key={location.pathname}><Outlet /></RouteContent></main></div>{mobileOpen && <button type="button" className="scrim" tabIndex={-1} aria-label="Close navigation" onClick={closeNavigation} />}</div>
}
