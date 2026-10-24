import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/shared'
import { regionalRequest, type RegionalInventoryRow } from '../regionalInventory.api'
import { regionalSettingsDraft } from '../openingStockForm'
import { RegionalConfigurationFields } from './RegionalConfigurationFields'

export function RegionalProductSettings({ row, disabled }: { row: RegionalInventoryRow; disabled: boolean }) {
  const [draft, setDraft] = useState({ price: row.sellingPriceOverride == null ? '' : String(row.sellingPriceOverride), threshold: row.lowStockThresholdOverride == null ? '' : String(row.lowStockThresholdOverride) })
  const [error, setError] = useState(''), [locked, setLocked] = useState(false)
  const request = useRef<object | null>(null), submitting = useRef(false)
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: (body: object) => regionalRequest(`/regions/${row.regionId}/products/${row.itemId}`, body, 'PATCH'), retry: false,
    onSuccess: async () => {
      request.current = null; setLocked(false)
      await Promise.all([client.invalidateQueries({ queryKey: ['regional'] }), client.invalidateQueries({ queryKey: ['sales'] })])
    },
  })
  async function submit() {
    if (disabled || save.isPending || submitting.current) return
    setError('')
    try {
      request.current ??= regionalSettingsDraft(draft)
      submitting.current = true; setLocked(true)
      await save.mutateAsync(request.current)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save regional configuration.')
      const status = (failure as { status?: number }).status
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) { request.current = null; setLocked(false) }
    } finally { submitting.current = false }
  }
  return <div className="region-product-settings">
    <div className="region-opening-row-fields"><RegionalConfigurationFields draft={draft} onChange={value => { setDraft(value); setError(''); save.reset() }} selected
      catalogPrice={row.catalogSellingPrice} catalogThreshold={row.catalogLowStockThreshold} disabled={disabled || save.isPending || locked} /></div>
    {error && <p role="alert">{error}</p>}
    {save.isSuccess && <p role="status">Regional settings saved. Stock quantity is unchanged.</p>}
    <Button type="button" disabled={disabled || save.isPending} onClick={submit}>{save.isPending ? 'Saving Settings...' : locked ? 'Retry Same Settings' : 'Save Product Settings'}</Button>
  </div>
}
