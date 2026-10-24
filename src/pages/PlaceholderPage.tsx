import { ChartNoAxesCombined } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ROUTE_LABELS } from '../constants/routes'

const pageDescriptions: Record<string, string> = {
  '/sales': 'Track daily sales, orders, and revenue by region.',
  '/purchases': 'Manage tea sourcing, suppliers, and purchase costs.',
  '/inventory': 'Monitor current stock levels and movement.',
  '/regions': 'Compare performance across your sales regions.',
  '/suppliers': 'Keep your supplier network organized.',
  '/reports': 'Explore trends and export business insights.',
  '/settings': 'Configure workspace preferences and alerts.',
}

export function PlaceholderPage() {
  const { pathname } = useLocation()
  return <div className="page placeholder"><div className="placeholder-icon"><ChartNoAxesCombined size={25} /></div><h1>{ROUTE_LABELS[pathname] ?? 'Page not found'}</h1><p>{pageDescriptions[pathname] ?? 'The requested workspace view is not available.'}</p><span className="coming">Workspace view ready for your data</span></div>
}
