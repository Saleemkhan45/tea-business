import { Wallet, Boxes, ChartNoAxesCombined, ChevronLeft, ChevronRight, LayoutDashboard, Leaf, Map, ReceiptText, Settings2, ShoppingCart, Truck, UsersRound, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../features/auth/auth.store'
import { ROUTES } from '../constants/routes'
import type { NavigationGroup } from '../types/navigation'

const navigationGroups: NavigationGroup[] = [
  { label: 'MAIN', items: [{ label: 'Dashboard', path: ROUTES.dashboard, icon: LayoutDashboard }] },
  { label: 'BUSINESS', items: [
    { label: 'Sales', path: ROUTES.sales, icon: ReceiptText },
    { label: 'Customers', path: ROUTES.customers, icon: UsersRound },
    { label: 'Purchases', path: ROUTES.purchases, icon: ShoppingCart },
    { label: 'Inventory', path: ROUTES.inventory, icon: Boxes },
    { label: 'Cash Book', path: ROUTES.cashBook, icon: Wallet },
    { label: 'Regions', path: ROUTES.regions, icon: Map },
    { label: 'Suppliers', path: ROUTES.suppliers, icon: Truck },
  ] },
  { label: 'ANALYTICS', items: [{ label: 'Reports', path: ROUTES.reports, icon: ChartNoAxesCombined }] },
  { label: 'SYSTEM', items: [{ label: 'Settings', path: ROUTES.settings, icon: Settings2 }] },
]

type SidebarProps = { sidebarRef?: Ref<HTMLElement>; mobile?: boolean; collapsed: boolean; open: boolean; onToggleCollapse: () => void; onClose: () => void }

export function Sidebar({ sidebarRef, mobile, collapsed, open, onToggleCollapse, onClose }: SidebarProps) {
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null)
  const role = useAuthStore(state => state.session?.user.role)
  function showTooltip(node: HTMLElement, label: string) {
    const rect = node.getBoundingClientRect()
    setTooltip({ label, top: Math.min(window.innerHeight - 24, Math.max(24, rect.top + rect.height / 2)), left: rect.right + 12 })
  }
  return <aside ref={sidebarRef} id="primary-navigation" role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} inert={mobile && !open} className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${open ? 'is-open' : ''}`} aria-label="Primary navigation">
    <div className="workspace-sidebar">
      <div className="brand">
        <div className="brand-avatar"><Leaf size={15} /></div>
        <div className="brand-copy"><strong>Tea Business</strong><span>Operations</span></div>
        <button type="button" className="sidebar-toggle" onClick={() => { setTooltip(null); onToggleCollapse() }} aria-expanded={!collapsed} aria-controls="primary-navigation" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}</button>
        <button type="button" className="mobile-close" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
      </div>
      <nav className="nav" aria-label="Dashboard sections" onScroll={() => setTooltip(null)}>{navigationGroups.map(group => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.filter(item => item.path !== ROUTES.cashBook || role === 'owner' || role === 'admin').map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === ROUTES.customers} aria-label={label} onMouseEnter={event => showTooltip(event.currentTarget, label)} onMouseLeave={() => setTooltip(null)} onFocus={event => showTooltip(event.currentTarget, label)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} onClick={() => { setTooltip(null); onClose() }} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={18} aria-hidden="true" /><span className="nav-item-label">{label}</span></NavLink>)}</div>)}</nav>
      <div className="workspace-footer"><span>Tea Business</span><strong>v1.0</strong></div>
    </div>
    {collapsed && !mobile && tooltip && createPortal(<div role="tooltip" className="sidebar-tooltip" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</div>, document.body)}
  </aside>
}
