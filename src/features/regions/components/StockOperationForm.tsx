import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, SelectMenu } from '../../../components/shared'
import { getPakistanBusinessDate, isValidBusinessDate } from '../../../business/utils/date'
import { regionalRequest, type LiveRegion } from '../regionalInventory.api'
import { useUnsavedEntryGuard } from '../../../components/shared/useUnsavedEntryGuard'

export function StockOperationForm({ region, products, regions }: { region: LiveRegion; products: Array<{ _id: string; name: string }>; regions: LiveRegion[] }) {
  const client = useQueryClient()
  const [type, setType] = useState('receipt')
  const [businessDate, setBusinessDate] = useState(getPakistanBusinessDate())
  const [reference, setReference] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [itemId, setItemId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [frozen, setFrozen] = useState<object | null>(null)
  const requestRef = useRef<object | null>(null)
  const submittingRef = useRef(false)
  const snapshot = JSON.stringify({ type, businessDate, reference, itemId, destinationId, quantity, reason })
  const savedSnapshot = useRef(snapshot)
  const operation = useMutation({ mutationFn: (body: object) => regionalRequest('/stock-operations', body), retry: false, onSuccess: async () => { requestRef.current = null; savedSnapshot.current = JSON.stringify({ type, businessDate, reference, itemId, destinationId, quantity: '', reason: '' }); setFrozen(null); setQuantity(''); setReason(''); setReviewed(false); await Promise.all([client.invalidateQueries({ queryKey: ['regional'] }), client.invalidateQueries({ queryKey: ['sales'] })]) } })
  useUnsavedEntryGuard(snapshot !== savedSnapshot.current, operation.isPending, Boolean(frozen) && operation.isError)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if(operation.isPending || submittingRef.current) return
    const grams = Math.round(Number(quantity) * 1000)
    if (!requestRef.current && (!itemId || !Number.isSafeInteger(grams) || grams === 0 || (type !== 'correction' && grams < 0) || Math.abs(Number(quantity) - grams / 1000) >= 1e-9 || !reason.trim() || !isValidBusinessDate(businessDate) || (type === 'transfer' && (!destinationId || destinationId === region._id)))) { setFormError('Choose a product, valid movement date, nonzero quantity (up to 3 decimals), reason and a different destination for transfers.'); return }
    setFormError('')
    if (!reviewed && !requestRef.current) { setReviewed(true); return }
    const body = requestRef.current ?? { type, regionId: region._id, itemId, destinationId: type === 'transfer' ? destinationId : undefined, quantityKg: Number(quantity), reason, businessDate, reference, idempotencyKey: crypto.randomUUID() }
    requestRef.current = body
    setFrozen(body)
    submittingRef.current = true
    try { await operation.mutateAsync(body) } catch { /* The mutation renders its error and retains uncertain requests. */ } finally { submittingRef.current = false }
  }
  return <form onSubmit={submit} className="regional-form">
    <h3>Record stock movement</h3>
    <p>Receipts add genuine new stock. Corrections use a signed difference. Transfers require the same product assigned to both regions.</p>
    <fieldset disabled={operation.isPending || Boolean(frozen) || reviewed}>
      <label>Operation<select value={type} onChange={event => setType(event.target.value)}>
        <option value="receipt">Stock receipt</option>
        <option value="correction">Audited correction</option>
        <option value="transfer">Transfer to another region</option>
      </select>
      </label>
      <label>{type === 'receipt' ? 'Receiving Region' : type === 'transfer' ? 'Source Region' : 'Adjustment Region'}<input readOnly value={region.name} /></label>
      <div className="regional-sale-field"><span>Tea Product *</span><SelectMenu value={itemId} options={[{ value: '', label: 'Select assigned product' }, ...products.map(product => ({ value: product._id, label: product.name }))]} onChange={setItemId} ariaLabel="Stock movement product" searchable inline /></div>
      {type === 'transfer' && <div className="regional-sale-field"><span>Transfer Destination *</span><SelectMenu value={destinationId} options={[{ value: '', label: 'Select destination region' }, ...regions.filter(row => row._id !== region._id && row.status === 'active').map(row => ({ value: row._id, label: row.name }))]} onChange={setDestinationId} ariaLabel="Transfer destination" searchable inline /></div>}
      <label>{type === 'correction' ? 'Stock difference (kg), positive or negative' : 'Quantity (kg)'}<input required type="number" min={type === 'correction' ? undefined : '0.001'} step="0.001" value={quantity} onChange={event => setQuantity(event.target.value)} />
      </label>
      <label>Transfer / Movement Date<input required type="date" value={businessDate} onChange={event => setBusinessDate(event.target.value)} /></label>
      <label>Reference<input maxLength={160} value={reference} onChange={event => setReference(event.target.value)} /></label>
      <label>Audit reason<input required maxLength={240} value={reason} onChange={event => setReason(event.target.value)} />
      </label>
    </fieldset>{formError && <p role="alert">{formError}</p>}{reviewed && !frozen && <p role="status">Confirm {quantity} kg for {region.name}{type === 'transfer' ? ' and the selected destination' : ''}. This creates an immutable stock movement. <Button type="button" onClick={() => setReviewed(false)}>Back to edit</Button></p>}{operation.isError && <p role="alert">{operation.error.message} Retry reuses the same request key and values.</p>}{operation.isSuccess && <p role="status">Stock operation recorded.</p>}<Button type="submit" variant="primary" loading={operation.isPending} disabled={operation.isPending}>{operation.isPending ? 'Recording...' : frozen ? 'Retry same operation' : reviewed ? 'Confirm stock movement' : 'Review stock movement'}</Button>
  </form>
}

