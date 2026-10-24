import { Flame, Target } from 'lucide-react'
import { Button, Panel, QueryFreshness } from '../../../components/shared'
import type { DateRangeValue } from '../../../components/shared'
import type { useTopSellingProducts } from '../../sales/useSales'
import './top-selling-products.css'

type Props = {
  query: Pick<ReturnType<typeof useTopSellingProducts>, 'data' | 'isPending' | 'isError' | 'isFetching' | 'refetch' | 'dataUpdatedAt'>
  dateRange: DateRangeValue
  regionId: string
}
const formatKg = (quantity: number) => `${quantity.toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`

export function TeaSales({ query, dateRange, regionId }: Props) {
  const products = query.data?.products ?? []
  const highest = products[0]?.quantityKg ?? 0
  const emptyMessage = regionId ? 'No sales recorded for this region during the selected period.' : dateRange.key === 'today' ? 'No products sold today.' : 'No products sold during the selected period.'
  return <Panel className="tea-panel top-products-panel" aria-busy={query.isFetching}>
    <div className="panel-heading"><div className="panel-title-row"><span className="panel-title-icon"><Target size={16} /></span><h2>Top Selling Products</h2></div></div>
    <p className="top-products-scope"><strong>{dateRange.label}</strong><span>{dateRange.startDate} to {dateRange.endDate}</span><span>{regionId ? 'Selected selling region' : 'All regions'} · quantity sold</span></p>
    <QueryFreshness query={query} label="product rankings" onRetry={() => void query.refetch()} />
    {query.isError && !query.data ? <div className="top-products-state" role="alert"><p>Unable to load top selling products.</p><Button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Retry</Button></div> : query.isPending ? <div className="top-products-skeleton" role="status" aria-label="Loading top selling products">{Array.from({ length: 5 }, (_, index) => <div key={index}><i /><span /><b /></div>)}</div> : products.length === 0 ? <p className="top-products-state">{emptyMessage}</p> : <>
      <div className="top-product-banner"><Flame size={15} aria-hidden="true" /><span>{dateRange.key === 'today' ? 'Most Sold Today' : 'Most Sold in Selected Period'}: <strong>{products[0].name}</strong></span></div>
      <ol className="ranked-products" aria-label="Products ranked by quantity sold">{products.map((product, index) => <li className="ranked-product" key={product.productId}>
        <span className="product-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
        <div className="ranked-product-copy"><strong>{product.name}</strong><div className="rank-track" aria-hidden="true"><span className="blue" style={{ width: `${highest > 0 ? Math.min(100, product.quantityKg / highest * 100) : 0}%` }} /></div></div>
        <span className="top-products-quantity">{formatKg(product.quantityKg)}</span>
      </li>)}</ol>
    </>}
  </Panel>
}
