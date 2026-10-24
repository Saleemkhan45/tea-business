import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Banknote, Boxes, Pencil, ShoppingBag, Wallet, X } from 'lucide-react'
import { Badge, Button, LoadingSpinner } from '../../../components/shared'
import { useProducts, useRegions } from '../../regions/regionalInventory.api'
import { useSupplier, type LiveSupplier } from '../supplier.api'
import type { ProfileTab } from '../supplierProfile.api'
import { SupplierProfileHistory } from './SupplierProfileHistory'
import { AddSupplierModal } from './AddSupplierModal'
import '../supplierProfile.css'

const tabs: { id: ProfileTab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'purchases', label: 'Purchase History' }, { id: 'payments', label: 'Payment History' }, { id: 'movements', label: 'Stock Movements' }, { id: 'activity', label: 'Activity & Edit History' }, { id: 'analytics', label: 'Analytics' }]
const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Not recorded'
type Props = { canManage: boolean; id: string; from: string; to: string; purchasesOnly: boolean; onViewExisting?: (id: string) => void; onClose: () => void }

export function SupplierDetailsDrawer({ id, from: initialFrom, to: initialTo, canManage, purchasesOnly, onViewExisting, onClose }: Props) {
  const [tab, setTab] = useState<ProfileTab>(purchasesOnly ? 'purchases' : 'overview')
  const [from, setFrom] = useState(initialFrom), [to, setTo] = useState(initialTo)
  const [editing, setEditing] = useState<LiveSupplier | null>(null), [notice, setNotice] = useState('')
  const valid = !from || !to || from <= to
  const query = useSupplier(id, valid ? from : initialFrom, valid ? to : initialTo)
  const regions = useRegions(), products = useProducts(), client = useQueryClient()
  const dialog = useRef<HTMLElement>(null), closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  const supplier = query.data?.supplier, stats = query.data?.stats, current = query.data?.currentStats
  const regionName = (id: string) => regions.data?.find(row => row._id === id)?.name || 'Unavailable region'
  const productName = (id: string) => products.data?.find(row => row._id === id)?.name || 'Unavailable product'
  const content = <>
    <div className="supplier-profile-backdrop" onMouseDown={event => { if (!editing && event.target === event.currentTarget) onClose() }}>
      <section ref={dialog} className="supplier-profile-dialog" role="dialog" aria-modal={!editing || undefined} aria-hidden={editing ? true : undefined} inert={Boolean(editing)} aria-labelledby="supplier-profile-title" onKeyDown={event => {
        if (editing) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
        if (event.key !== 'Tab') return
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),input:not(:disabled),select:not(:disabled),a[href]') ?? [])].filter(node => node.getClientRects().length)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
        <header className="supplier-profile-header"><span className="supplier-profile-avatar" aria-hidden="true">{supplier?.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'S'}</span><div className="supplier-profile-heading"><span>Supplier profile</span><h2 id="supplier-profile-title">{supplier?.name || 'Supplier Details'}</h2><p>{supplier && <Badge tone={supplier.status === 'active' ? 'success' : 'warning'}>{supplier.status}</Badge>} {supplier?.phone || 'No phone provided'}</p></div><div className="supplier-profile-header-actions">{canManage && supplier && <Button onClick={() => setEditing(supplier)}><Pencil size={16} aria-hidden="true" /> Edit Supplier</Button>}<button ref={closeRef} type="button" className="supplier-profile-close" onClick={onClose} aria-label="Close supplier details"><X size={22} /></button></div></header>
        <div className="supplier-profile-body">
          {notice && <p className="supplier-profile-success" role="status">{notice}</p>}
          {query.isFetching && <LoadingSpinner showLabel label="Loading supplier profile…" />}
          {query.isError && <div role="alert"><p>{query.error.message}</p><Button onClick={() => void query.refetch()}>Retry profile</Button></div>}
          {supplier && stats && current && <>
            <div className="supplier-profile-period"><label>Purchase period from<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label><Button onClick={() => { setFrom(''); setTo('') }}>Lifetime</Button><span>{from || to ? 'Selected-period purchase statistics' : 'Lifetime purchase statistics'} · excludes voids</span></div>
            {!valid && <p role="alert">End date must follow start date.</p>}
            <div className="supplier-profile-kpis">{[
              { label: 'Total Purchases', value: String(stats.count), icon: ShoppingBag }, { label: 'Purchased Quantity', value: `${stats.quantityKg.toLocaleString()} kg`, icon: Boxes },
              { label: 'Purchase Value', value: money(stats.valuePkr), icon: Banknote }, { label: 'Outstanding Invoice Payables', value: money(current.outstandingPkr), icon: Wallet },
            ].map(({ label, value, icon: Icon }) => <div key={label}><Icon size={19} aria-hidden="true" /><span>{label}</span><strong>{value}</strong><small>{label === 'Outstanding Invoice Payables' ? 'Current · lifetime recorded invoices' : from || to ? 'Selected period' : 'Lifetime'}</small></div>)}</div>
            {current.unknownPayableCount > 0 && <p className="supplier-profile-hint">{current.unknownPayableCount} legacy invoices have unknown payment attribution and are excluded from confirmed invoice payables.</p>}
            <div className="supplier-profile-tabs" role="tablist" aria-label="Supplier profile sections">{tabs.map(({ id: value, label }, index) => <button key={value} type="button" id={`supplier-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="supplier-profile-panel" tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
              if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
              setTab(tabs[next].id); document.getElementById(`supplier-tab-${tabs[next].id}`)?.focus()
            }}>{label}</button>)}</div>
            <div role="tabpanel" id="supplier-profile-panel" aria-labelledby={`supplier-tab-${tab}`} className="supplier-profile-panel">
              {tab === 'overview' ? <div className="supplier-overview-grid">
                <section className="supplier-info-card"><h3>Supplier information</h3><dl>{[['Name', supplier.name], ['Status', supplier.status], ['Contact person', supplier.contactPerson], ['Main phone', supplier.phone], ['Alternate phone', supplier.alternatePhone], ['Email', supplier.email], ['Location', supplier.city], ['Full address', supplier.address]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl></section>
                <section className="supplier-info-card"><h3>Business information</h3><dl>{[['Regions served', supplier.regions.map(regionName).join(', ') || 'Not configured'], ['Products supplied', supplier.productOfferings.join(', ') || 'Not configured'], ['Catalog-linked products', supplier.products.map(productName).join(', ') || 'Not configured'], ['Latest purchase · lifetime', current.lastPurchase || 'No purchases'], ['Date created', dateTime(supplier.createdAt)], ['Last updated', dateTime(supplier.updatedAt)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
                <section className="supplier-info-card supplier-profile-notes"><h3>Profile notes</h3><p>{supplier.notes || 'Not provided'}</p></section>
              </div> : <>
                {tab === 'payments' && <div className="supplier-payment-totals"><span>Total invoiced <strong>{money(current.invoicedPkr)}</strong></span><span>Recorded payments <strong>{money(current.paymentsPkr)}</strong></span><span>Outstanding <strong>{money(current.outstandingPkr)}</strong></span><p>Current lifetime confirmed invoices · excludes voids and unknown legacy balances.</p></div>}
                {valid && <SupplierProfileHistory key={tab} id={id} tab={tab} from={from} to={to} onNavigate={onClose} />}
              </>}
            </div>
          </>}
        </div>
      </section>
    </div>
    {editing && <AddSupplierModal supplier={editing} onClose={() => setEditing(null)} onSave={() => { setEditing(null); setNotice('Supplier profile updated successfully.'); void Promise.all([client.invalidateQueries({ queryKey: ['suppliers'] }), client.invalidateQueries({ queryKey: ['purchases', 'options'] })]) }} onViewExisting={existingId => { setEditing(null); if (existingId !== id && onViewExisting) onViewExisting(existingId); else void query.refetch() }} />}
  </>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
