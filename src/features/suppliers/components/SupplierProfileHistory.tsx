import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, LoadingSpinner } from '../../../components/shared'
import { useRegions } from '../../regions/regionalInventory.api'
import { useSupplierHistory, type ProfileTab, type SupplierHistoryRow } from '../supplierProfile.api'

const money = (amount?: number) => amount === undefined ? 'Not recorded' : `PKR ${amount.toLocaleString('en-PK')}`
const purchasePath = (id: string) => `/purchases?record=${encodeURIComponent(id)}`
const display = (value: unknown): string => value == null || value === '' ? 'Not provided' : Array.isArray(value) ? value.map(display).join(', ') || 'Not configured' : String(value)

export function SupplierProfileHistory({ id, tab, from, to, onNavigate }: { id: string; tab: ProfileTab; from: string; to: string; onNavigate: () => void }) {
  const [search, setSearch] = useState(''), [term, setTerm] = useState(''), [status, setStatus] = useState(''), [region, setRegion] = useState(''), [page, setPage] = useState(1)
  const regions = useRegions()
  useEffect(() => { if (search.trim() === term) return; const timer = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 300); return () => clearTimeout(timer) }, [search, term])
  useEffect(() => { setPage(1) }, [from, to, tab])
  const query = useSupplierHistory(id, tab, { from, to, page: String(page), limit: '10', search: term, status, region })
  const data = query.data
  function link(row: SupplierHistoryRow) { const id = row.purchaseId ?? row._id; return id ? <Link className="supplier-profile-link" to={purchasePath(id)} onClick={onNavigate}>View Purchase</Link> : 'Not recorded' }
  const empty = { purchases: 'No purchases recorded for this supplier.', payments: 'No supplier payments recorded.', movements: 'No related stock movements.', activity: 'No recorded profile changes yet.', analytics: 'Analytics will appear when purchase data is available.', overview: '' }[tab]
  return <section aria-label={`${tab} history`}>
    {tab !== 'activity' && <><div className="supplier-profile-filters">
      <label>Search invoices<input type="search" maxLength={160} placeholder="Reference, product or region" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Purchase status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['received', 'pending', 'in_transit', 'voided'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Receiving region<select value={region} onChange={event => { setRegion(event.target.value); setPage(1) }}><option value="">All regions</option>{regions.data?.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
    </div><p className="supplier-profile-hint">Filters select invoices by purchase date. Payments include all recorded payments on those invoices; movements include their receipts and reversals. Current payables above remain lifetime totals.</p></>}
    {query.isFetching && <LoadingSpinner showLabel label={`Loading supplier ${tab}…`} />}
    {query.isError && <div role="alert"><p>{query.error.message}</p><Button onClick={() => void query.refetch()}>Retry {tab}</Button></div>}
    {data && !query.isError && (tab === 'analytics' ? !data.products.length ? <p className="supplier-profile-empty">{empty}</p> : <div className="supplier-analytics-grid">{(['products', 'regions', 'trend'] as const).map(group => <section className="supplier-info-card" key={group}><h3>{group === 'products' ? 'Most frequently purchased products' : group === 'regions' ? 'Receiving region distribution' : 'Purchase trend by business date'}</h3><p>Up to 30 {group === 'trend' ? 'latest dates' : 'leading groups'} · non-void invoices</p>{data[group].map(row => <div className="supplier-analytics-row" key={row.name}><strong>{row.name}</strong><span>{row.count} purchases · {row.quantityKg.toLocaleString()} kg</span><span>{money(row.valuePkr)}</span></div>)}</section>)}</div>
      : !data.rows.length ? <p className="supplier-profile-empty">{empty}{tab !== 'activity' && ' Adjust filters if needed.'}</p> : <>
        {tab === 'activity' ? <div className="supplier-activity-list">{data.rows.map(row => <article className="supplier-info-card" key={row._id}><h3>{row.action === 'create' ? 'Supplier created' : 'Supplier profile updated'} <small>Revision {row.revision}</small></h3><p>{row.operatorName || 'Former operator'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Not recorded'}</p><dl>{row.changes?.map(change => <div key={change.field}><dt>{change.field.replace(/([A-Z])/g, ' $1')}</dt><dd><span>{display(change.previous)}</span><span aria-label="changed to"> → </span><strong>{display(change.next)}</strong></dd></div>)}</dl></article>)}</div>
          : <div className="supplier-profile-table-wrap" tabIndex={0} role="region" aria-label={`${tab} table, scroll horizontally if needed`}><table className="supplier-profile-table"><thead><tr>{(tab === 'purchases' ? ['Date', 'Reference', 'Product', 'Quantity', 'Unit Cost', 'Total', 'Receiving Region', 'Status', 'Actions'] : tab === 'payments' ? ['Payment Date', 'Invoice', 'Amount', 'Method', 'Recorded By', 'Reference', 'Notes', 'Status', 'Actions'] : ['Date', 'Purchase Reference', 'Product', 'Quantity', 'Receiving Region', 'Movement', 'Invoice Status', 'Operator', 'Related Transaction']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={row._id ?? `${row.purchaseId}-${row.paymentIndex ?? index}`}>
            {tab === 'purchases' ? <><td>{row.businessDate}</td><td>{row.reference || 'No reference'}</td><td>{row.productName || 'Historical product'}</td><td>{row.quantityKg} kg</td><td>{money(row.unitCost)}</td><td>{money(row.totalAmount)}</td><td>{row.regionName || 'Legacy unallocated'}</td><td><Badge tone={row.status === 'voided' ? 'danger' : 'neutral'}>{row.status?.replaceAll('_', ' ')}</Badge></td><td>{link(row)}</td></>
              : tab === 'payments' ? <><td>{row.date}</td><td>{row.reference || 'No reference'}</td><td>{money(row.amountPkr)}</td><td>{row.method?.replaceAll('_', ' ')}</td><td>{row.operatorName || 'Former operator'}</td><td>{row.paymentReference || 'Not provided'}</td><td>Not recorded</td><td>{row.invoiceStatus === 'voided' ? 'Voided invoice · excluded from payables' : 'Recorded'}</td><td>{link(row)}</td></>
                : <><td>{row.date || row.createdAt?.slice(0, 10)}</td><td>{row.reference || 'No reference'}</td><td>{row.productName || 'Historical product'}</td><td>{(row.quantityGrams ?? 0) / 1000} kg</td><td>{row.regionName || regions.data?.find(region => region._id === row.region)?.name || 'Not recorded'}</td><td>{row.type === 'purchase_reversal' ? 'Purchase reversal' : 'Purchase receipt'}</td><td>{row.invoiceStatus}</td><td>{row.operatorName || 'Former operator'}</td><td>{link(row)}{row.reason && <small>{row.reason}</small>}</td></>}
          </tr>)}</tbody></table></div>}
        <div className="supplier-profile-pagination"><span>{data.total} records · Page {page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span><Button disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><Button disabled={page * data.limit >= data.total || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
      </>)}
  </section>
}
