import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button, SelectMenu, useCloseOnEscape } from '../../../components/shared'
import { regionalRequest, useProducts, useRegionalInventory, type LiveRegion } from '../regionalInventory.api'
import { MAX_OPENING_PRODUCTS, newOpeningRow, openingStockDraft, type OpeningProductRow } from '../openingStockForm'
import { CatalogProductModal, type CatalogProductResult } from './CatalogProductModal'
import { SuccessToast } from '../../../components/shared'
import { RegionalConfigurationFields } from './RegionalConfigurationFields'
import { formatPKR } from '../../../business/utils/formatters'
import { RegionalProductSettings } from './RegionalProductSettings'
import '../../customers/customers.css'
import '../../sales/components/regionalSaleSelectors.css'

export function RegionEditor({ region, onClose, onSaved }: { region?: LiveRegion; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: region?.name ?? '', city: region?.city ?? '', manager: region?.manager ?? '', phone: region?.phone ?? '', address: region?.address ?? '', description: region?.description ?? '', status: region?.status ?? 'active' })
  const [rows, setRows] = useState<OpeningProductRow[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [assignment, setAssignment] = useState('')
  const [removeId, setRemoveId] = useState('')
  const products = useProducts(), inventory = useRegionalInventory(region?._id ?? '', Boolean(region)), client = useQueryClient()
  const request = useRef<object | null>(null), submitting = useRef(false)
  const dialog = useRef<HTMLElement>(null)
  async function refreshInventory() {
    await Promise.all([client.invalidateQueries({ queryKey: ['regional'] }), client.invalidateQueries({ queryKey: ['sales'] })])
  }
  const save = useMutation({ mutationFn: (body: object) => regionalRequest(region ? `/regions/${region._id}` : '/regions', body, region ? 'PATCH' : 'POST'), retry: false, onSuccess: async () => { await refreshInventory(); onSaved() } })
  const association = useMutation({ mutationFn: ({ itemId, remove = false }: { itemId: string; remove?: boolean }) => regionalRequest(`/regions/${region!._id}/products${remove ? `/${itemId}` : ''}`, remove ? undefined : { itemId }, remove ? 'DELETE' : 'POST'), retry: false, onSuccess: async () => { setAssignment(''); setRemoveId(''); await refreshInventory() } })
  const busy = save.isPending || association.isPending
  let totalKg: number | null = null
  try { totalKg = openingStockDraft(rows).totalKg } catch { /* Incomplete rows are validated on save. */ }
  useCloseOnEscape(onClose, !busy && !catalogOpen)
  useEffect(() => {
    const overflow = document.body.style.overflow, focus = document.activeElement
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector('input')?.focus()
    return () => { document.body.style.overflow = overflow; if (focus instanceof HTMLElement) focus.focus() }
  }, [])
  function catalogSaved({ product, pendingOpeningKg }: CatalogProductResult) {
    setCatalogOpen(false)
    if (!region && product.status === 'active') {
      setRows(current => [...current, { ...newOpeningRow(), itemId: product._id, quantity: String(pendingOpeningKg) }])
      if (pendingOpeningKg > 0) setConfirmed(false)
    }
    setToast(product.status === 'active' ? 'Tea product saved successfully.' : 'Inactive product saved to the catalog; activate it before assignment.')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || submitting.current) return
    setError('')
    try {
      if (!request.current) {
        if (!form.name.trim()) throw new Error('Enter a region name.')
        const opening = openingStockDraft(rows)
        if (!region && opening.totalKg > 0 && !confirmed) throw new Error('Confirm that opening stock is genuine and not recorded elsewhere.')
        request.current = region ? { ...form } : { ...form, openingProducts: opening.openingProducts, openingStockConfirmed: confirmed, idempotencyKey: crypto.randomUUID() }
      }
      submitting.current = true; setLocked(true)
      await save.mutateAsync(request.current)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save region.')
      const status = (failure as { status?: number }).status
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) { request.current = null; setLocked(false) }
    } finally { submitting.current = false }
  }
  return <div className="customer-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !save.isPending && onClose()}>
    <section ref={dialog} inert={catalogOpen} aria-hidden={catalogOpen || undefined} className="customer-modal customer-add-modal region-editor-modal" role="dialog" aria-modal="true" aria-labelledby="region-editor-title" onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}><header className="customer-modal-header"><div><span>Region management</span><h2 id="region-editor-title">{region ? 'Edit Region' : 'Add Region'}</h2></div><button type="button" disabled={save.isPending} onClick={onClose} aria-label="Close region form"><X size={18} /></button></header>
      <form onSubmit={submit}><fieldset className="regional-form regional-purchase-fields" disabled={busy || locked}>
        <h3>Region Information</h3>
        {(['name', 'city', 'manager', 'phone'] as const).map(field => <label key={field}>{field === 'name' ? 'Region Name *' : field === 'city' ? 'City / Location' : field === 'manager' ? 'Region Manager (optional)' : 'Phone Number'}<input required={field === 'name'} type={field === 'phone' ? 'tel' : 'text'} maxLength={field === 'phone' ? 40 : field === 'manager' ? 160 : 120} value={form[field]} onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))} /></label>)}
        <label>Address<textarea rows={3} maxLength={300} value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} /></label>
        <label>Description<textarea rows={3} maxLength={1000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
        <label>Status<select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as 'active' | 'inactive' }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <small>Changing region details does not move stock or rewrite historical transactions.</small>
      </fieldset>
      {!region ? <fieldset className="regional-purchase-fields region-opening-section" disabled={busy || locked}><h3>Tea Products &amp; Opening Stock</h3><p>Assign up to 20 catalog products. Zero quantity assigns a product without adding stock. Opening stock is not a supplier purchase.</p>
        {products.isPending && <p role="status">Loading tea catalog...</p>}
        {products.isError && <p role="alert">Unable to load products. <Button type="button" onClick={() => void products.refetch()}>Retry catalog</Button></p>}
        {!products.isPending && !products.isError && !(products.data ?? []).some(product => product.status === 'active') && <p>No active products. Create a catalog product to select it here.</p>}
        <div className="page-actions"><Button type="button" disabled={rows.length >= MAX_OPENING_PRODUCTS || busy || locked} onClick={() => setCatalogOpen(true)}>+ Catalog Product</Button><Button type="button" onClick={() => void products.refetch()}>Refresh catalog</Button></div>
        {rows.map((row, index) => { const product = products.data?.find(value => value._id === row.itemId); return <div className="region-opening-row" key={row.key}><div className="region-opening-row-heading"><h4>Product {index + 1}</h4><Button type="button" aria-label={`Remove product ${index + 1}`} onClick={() => setRows(current => current.filter(value => value.key !== row.key))}>Remove Product</Button></div><div className="region-opening-row-fields"><div className="regional-sale-field"><span>Tea Product *</span><SelectMenu value={row.itemId} options={[{ value: '', label: 'Search tea catalog' }, ...(products.data ?? []).filter(value => value.status === 'active' && (value._id === row.itemId || !rows.some(other => other.itemId === value._id))).map(value => ({ value: value._id, label: `${value.name} ? ${value.teaType} ? ${value.sellingPrice == null ? 'Price not configured' : formatPKR(value.sellingPrice) + '/kg'}` }))]} onChange={itemId => setRows(current => current.map(value => value.key === row.key ? { ...value, itemId, price: '', threshold: '' } : value))} ariaLabel={`Tea product ${index + 1}`} searchable inline disabled={busy || locked} /></div><label>Opening Quantity (kg) *<input required type="number" min="0" step="0.001" value={row.quantity} onChange={event => setRows(current => current.map(value => value.key === row.key ? { ...value, quantity: event.target.value } : value))} /></label><RegionalConfigurationFields draft={{ price: row.price ?? '', threshold: row.threshold ?? '' }} selected={Boolean(product)} catalogPrice={product?.sellingPrice} catalogThreshold={product?.lowStockThreshold} disabled={busy || locked} onChange={settings => setRows(current => current.map(value => value.key === row.key ? { ...value, ...settings } : value))} /></div></div> })}
        <small>Regional overrides apply only to this region. Leave a field blank to inherit its catalog default.</small><Button type="button" disabled={rows.length >= MAX_OPENING_PRODUCTS || products.isPending || products.isError} onClick={() => setRows(current => current.length < MAX_OPENING_PRODUCTS ? [...current, newOpeningRow()] : current)}>+ Add Another Product</Button>
        <p role="status">Total Product Types: {new Set(rows.filter(row => row.itemId).map(row => row.itemId)).size} / 20 · Total Opening Stock: {totalKg === null ? 'Complete valid rows to calculate' : `${totalKg.toLocaleString('en-PK')} kg`}</p>
        {rows.length > 0 && <label className="region-opening-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm these quantities are genuine opening stock, not stock already recorded in another region or the legacy inventory pool.</label>}
      </fieldset> : <fieldset className="regional-purchase-fields region-opening-section" disabled={busy || locked}><h3>Assigned Tea Products</h3>{region.status === 'active' && <Button type="button" disabled={busy || locked} onClick={() => setCatalogOpen(true)}>+ Catalog Product</Button>}<p>Quantities are read-only. Use audited adjustments, purchase receipts or transfers to change stock.</p>{inventory.isPending && <p role="status">Loading assigned inventory...</p>}{inventory.isError && <p role="alert">Unable to load assignments. <Button type="button" onClick={() => void inventory.refetch()}>Retry inventory</Button></p>}{inventory.data?.length === 0 && <p>No products assigned.</p>}{inventory.data?.map(row => <div className="region-opening-row" key={row.id}><strong>{row.name}</strong><p>{row.availableKg.toLocaleString('en-PK')} kg · {row.status}</p><RegionalProductSettings row={row} disabled={busy || locked} /><a href={`/regions?region=${region._id}`}>View stock history and audited movements</a>{row.availableKg === 0 && <Button type="button" onClick={() => setRemoveId(row.itemId)}>Remove unused assignment</Button>}{removeId === row.itemId && <div><p>Remove this zero-stock assignment? The server will reject removal if it has sales, purchases or stock history.</p><Button type="button" onClick={() => association.mutate({ itemId: row.itemId, remove: true })}>Confirm removal</Button><Button type="button" onClick={() => setRemoveId('')}>Keep assignment</Button></div>}</div>)}
        {region.status === 'active' && <><div className="regional-sale-field"><SelectMenu value={assignment} options={[{ value: '', label: 'Choose a catalog product to assign' }, ...(products.data ?? []).filter(product => product.status === 'active' && !inventory.data?.some(row => row.itemId === product._id)).map(product => ({ value: product._id, label: product.name }))]} onChange={setAssignment} ariaLabel="Assign another tea product" searchable inline disabled={busy || locked || inventory.isPending || inventory.isError} /></div><Button type="button" disabled={!assignment || inventory.isPending || inventory.isError} onClick={() => association.mutate({ itemId: assignment })}>Assign at zero stock</Button></>}{association.isError && <p role="alert">{association.error.message}</p>}
      </fieldset>}
      {error && <p className="regional-purchase-review" role="alert">{error}</p>}{locked && !save.isPending && <p className="regional-purchase-review" role="status">Retry preserves the original values and creation key. Reopening as a new request after an uncertain result can create a conflicting intent.</p>}<footer className="customer-modal-footer"><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={save.isPending} disabled={busy}>{save.isPending ? 'Saving...' : locked ? 'Retry Same Save' : 'Save Region'}</Button></footer></form>
    </section>
    {catalogOpen && <CatalogProductModal pendingRegion={!region} receivingRegionId={region?._id} onClose={() => setCatalogOpen(false)} onSaved={catalogSaved} />}
    {toast && <SuccessToast message={toast} onDismiss={() => setToast('')} />}
  </div>
}

