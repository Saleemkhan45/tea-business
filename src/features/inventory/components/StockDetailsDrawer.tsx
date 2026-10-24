import { ArrowDownLeft, ArrowUpRight, Boxes, X } from 'lucide-react'
import { Badge, Button, useCloseOnEscape } from '../../../components/shared'
import type { InventoryRecord } from '../types/inventory'

type StockDetailsDrawerProps = { inventory: InventoryRecord; onClose: () => void }
const formatCurrency = (value: number) => `PKR ${value.toLocaleString('en-PK')}`

export function StockDetailsDrawer({ inventory, onClose }: StockDetailsDrawerProps) {
  useCloseOnEscape(onClose)
  return <div className="inventory-drawer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="inventory-drawer" role="dialog" aria-modal="true" aria-labelledby="stock-details-title"><div className="drawer-header"><div className="drawer-title-icon"><Boxes size={19} /></div><div><span className="modal-eyebrow">Inventory detail</span><h2 id="stock-details-title">{inventory.teaType}</h2><p>{inventory.region} stock location</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close stock details"><X size={19} /></button></div><div className="drawer-content"><div className="drawer-stock-hero"><div><span>Current stock</span><strong>{inventory.availableStock.toLocaleString()} kg</strong></div><Badge tone={inventory.stockStatus === 'In Stock' ? 'success' : inventory.stockStatus === 'Low Stock' ? 'warning' : 'danger'}>{inventory.stockStatus}</Badge></div><div className="drawer-metrics"><div><span>Reserved stock</span><strong>{inventory.reservedStock.toLocaleString()} kg</strong></div><div><span>Available for sale</span><strong>{Math.max(inventory.availableStock - inventory.reservedStock, 0).toLocaleString()} kg</strong></div><div><span>Average purchase cost</span><strong>{formatCurrency(inventory.averageCost)} / kg</strong></div></div><HistorySection title="Purchase history" icon={<ArrowDownLeft size={15} />} items={inventory.purchaseHistory} tone="purchase" /><HistorySection title="Sales history" icon={<ArrowUpRight size={15} />} items={inventory.salesHistory} tone="sale" /></div><div className="drawer-footer"><Button onClick={onClose}>Close details</Button></div></aside></div>
}

function HistorySection({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: InventoryRecord['purchaseHistory']; tone: 'purchase' | 'sale' }) {
  return <section className="history-section"><div className="history-heading"><h3>{title}</h3><span className={`history-icon ${tone}`}>{icon}</span></div>{items.map(item => <div className="history-row" key={`${item.date}-${item.quantity}`}><div><strong>{item.quantity.toLocaleString()} kg</strong><span>{item.note}</span></div><time>{item.date}</time></div>)}</section>
}
