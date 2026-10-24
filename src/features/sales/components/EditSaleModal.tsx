import type { SaleDto } from '../types/salesApi'
import { useUpdateSale } from '../useSales'
import { SaleEntryForm } from './SaleEntryForm'

type Props = { sale: SaleDto; onClose: () => void; onSave: (sale: SaleDto) => void }

export function EditSaleModal({ sale, onClose, onSave }: Props) {
  const mutation = useUpdateSale(sale._id, sale.customer)
  return <SaleEntryForm
    sale={sale}
    onClose={onClose}
    submitting={mutation.isPending}
    error={mutation.error}
    onSubmit={async input => {
      try {
        const response = await mutation.mutateAsync(input)
        onSave(response.sale)
      } catch { /* The mutation error is displayed by the form. */ }
    }}
  />
}
