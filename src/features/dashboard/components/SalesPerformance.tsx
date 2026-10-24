import { Panel, SummaryCard } from '../../../components/shared'
import type { LiveDashboard } from '../services/dashboard.service'
import { formatDashboardPkr } from '../formatters'
export function SalesPerformance({ khata, creditSalesPkr }: { khata: LiveDashboard['khata']; creditSalesPkr: number }) {
  return <Panel className="sales-performance-panel"><div className="panel-heading"><h2>Customer Khata Overview</h2></div>
    <p>Balances and customer payments cover the whole shop; standalone payments have no selling region.</p>
    <div className="summary-grid"><SummaryCard title="Outstanding Customer Khata" value={formatDashboardPkr(khata.outstandingPkr)} detail="Current positive ledger balances · all dates" /><SummaryCard title="Payments Received Today" value={formatDashboardPkr(khata.paymentsTodayPkr)} detail={`${khata.today} · customer ledger payments only`} /><SummaryCard title="Credit Sales" value={formatDashboardPkr(creditSalesPkr)} detail="Selected sales period and region" /><SummaryCard title="Customers with Outstanding Balances" value={khata.customers.toLocaleString('en-PK')} detail="Current shop-wide ledger balances" /></div>
  </Panel>
}

