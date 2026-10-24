import { useSaleSubmission } from '../useSaleSubmission'
import type { SaleDto } from '../types/salesApi'
import { SaleEntryForm } from './SaleEntryForm'
import type { SaleDraft } from '../saleCustomerNavigation'
import { useSaleCustomerNavigation } from '../useSaleCustomerNavigation'

type Props = { onClose: () => void; onSave: (sale: SaleDto) => void; initialCustomerId?: string; initialDraft?: SaleDraft }

export function AddSaleModal({ onClose, onSave, initialCustomerId, initialDraft }: Props) {
  const submission = useSaleSubmission()
  const navigation = useSaleCustomerNavigation()
  function close() {
    if (submission.reset()) onClose()
  }
  return <SaleEntryForm
    initialCustomerId={initialCustomerId}
    initialDraft={initialDraft}
    onAddNewCustomer={draft => {
      if (!submission.hasActiveRequest && submission.reset()) navigation.beginCustomerCreation(draft)
    }}
    onClose={close}
    submitting={submission.status === 'submitting'}
    locked={submission.hasActiveRequest}
    error={submission.error}
    onReset={() => submission.reset()}
    onSubmit={async input => {
      const sale = await submission.submit(input)
      if (sale) onSave(sale)
    }}
  />
}
