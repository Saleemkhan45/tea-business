import { GlobalSearchModal } from '../features/global-search/GlobalSearchModal'
import { BarChart3, LogOut, Menu, Moon, Search, Settings2, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../app/theme'
import { ROUTES } from '../constants/routes'
import { NotificationBell } from '../features/notifications/components/NotificationBell'
import { useAuthStore } from '../features/auth/auth.store'
import { logout } from '../features/auth/auth.api'

type HeaderProps = { onMenu: () => void; menuOpen?: boolean }
type HeaderPopover = 'admin' | null

export function Header({ onMenu, menuOpen = false }: HeaderProps) {
  const [theme, setTheme] = useTheme()
  const [activePopover, setActivePopover] = useState<HeaderPopover>(null)
  const user = useAuthStore(state => state.session?.user)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const darkMode = theme === 'dark'
  const closePopovers = useCallback(() => setActivePopover(null), [])

  function togglePopover(popover: Exclude<HeaderPopover, null>) {
    setActivePopover(current => current === popover ? null : popover)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {

        closePopovers()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable=true]')) return
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closePopovers])

  useEffect(() => {
    if (!activePopover) return undefined

    function handleOutsidePointer(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) closePopovers()
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [activePopover, closePopovers])

  return <header className="topbar">
    <div className="topbar-left">
      <button type="button" className="mobile-menu" onClick={onMenu} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="primary-navigation"><Menu size={21} /></button>
      <span className="mobile-brand">Tea Business</span>
      <button ref={searchTriggerRef} type="button" className="header-search global-search-trigger" aria-label="Search dashboard" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Search size={16} aria-hidden="true" /><span>Search dashboard</span><kbd>Ctrl / Cmd K</kbd></button>
      {searchOpen && <GlobalSearchModal triggerRef={searchTriggerRef} onClose={() => setSearchOpen(false)} />}
    </div>

    <div ref={actionsRef} className="header-actions" aria-label="Dashboard tools">
      <NavLink
        to={ROUTES.reports}
        className={({ isActive }) => `icon-button report-shortcut ${isActive ? 'is-active' : ''}`}
        title="Reports"
        aria-label="Open reports"
        onClick={closePopovers}
      >
        <BarChart3 size={18} />
        <span className="sr-only">Reports</span>
        <i aria-hidden="true" />
      </NavLink>

      <NotificationBell />

      <button
        type="button"
        className="icon-button theme-toggle"
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={darkMode}
        onClick={() => setTheme(darkMode ? 'light' : 'dark')}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        <span className="sr-only">{darkMode ? 'Light mode' : 'Night mode'}</span>
      </button>

      <div className="header-popover-wrap admin-popover-wrap">
        <button
          type="button"
          className={`admin-trigger ${activePopover === 'admin' ? 'is-active' : ''}`}
          title="Account profile"
          aria-label="Open account profile menu"
          aria-haspopup="menu"
          aria-expanded={activePopover === 'admin'}
          aria-controls="header-admin-menu"
          onClick={() => togglePopover('admin')}
        >
          <span className="admin-avatar" aria-hidden="true"><UserRound size={16} /></span>
          <span className="admin-trigger-copy"><strong>{user?.name ?? 'Account'}</strong><span>{user?.role ?? ''}</span></span>
        </button>

        {activePopover === 'admin' && <div id="header-admin-menu" className="header-popover admin-popover" role="menu" aria-label="Account menu">
          <div className="admin-popover-card">
            <span className="admin-avatar admin-avatar-lg" aria-hidden="true"><UserRound size={18} /></span>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <NavLink to={ROUTES.settings} role="menuitem" className="admin-menu-item" onClick={closePopovers}><Settings2 size={16} /><span>Account settings</span></NavLink>
          <button type="button" role="menuitem" className="admin-menu-item" onClick={() => { setTheme(darkMode ? 'light' : 'dark'); closePopovers() }}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Switch to light mode' : 'Switch to night mode'}</span></button>
          <div className="admin-status-note"><ShieldCheck size={15} /><span>Operations access active</span></div>
          <button type="button" role="menuitem" className="admin-menu-item" disabled={loggingOut} onClick={async () => {
            if (loggingOut) return
            setLoggingOut(true)
            setLogoutError('')
            try { await logout() } catch (error) { setLogoutError(error instanceof Error ? error.message : 'Unable to log out.') }
            finally { setLoggingOut(false) }
          }}><LogOut size={16} /><span>{loggingOut ? 'Signing out...' : 'Log out'}</span></button>
          {logoutError && <p role="alert" className="auth-error">{logoutError}</p>}
        </div>}
      </div>
    </div>
  </header>
}
