import { Panel } from '../../../components/shared'
import type { LiveDashboard } from '../services/dashboard.service'
import { formatDashboardPkr } from '../formatters'
export function ActiveOrders({ sales }: { sales: LiveDashboard['recentSales'] }) {
  return <Panel className="active-orders-panel"><div className="panel-heading"><h2>Recent Sales</h2></div>{sales.length === 0 ? <p role="status">No sales recorded for the selected period and region.</p> : <div className="table-responsive" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr>{['Sale Date', 'Customer', 'Product', 'Quantity', 'Selling Region', 'Sale Amount', 'Payment Method', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{sales.map(sale => <tr key={sale._id}><td>{sale.businessDate}</td><td>{sale.customerName || 'Not recorded'}</td><td>{sale.productName || 'Not recorded'}</td><td>{sale.quantityKg == null ? 'Not recorded' : `${sale.quantityKg.toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`}</td><td>{sale.sellingRegionName || 'Unallocated / historical'}</td><td>{formatDashboardPkr(sale.totalAmount)}</td><td>{sale.paymentMethod?.replaceAll('_', ' ') || 'Not recorded'}</td><td>{sale.status}</td></tr>)}</tbody></table></div>}</Panel>
}

