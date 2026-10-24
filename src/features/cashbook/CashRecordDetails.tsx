import { useState } from 'react'
import { Button, LoadingSpinner } from '../../components/shared'
import { formatPKR } from '../../business/utils/formatters'
import { cashErrorMessage, useCashQuery, type CashDetails, type CashValues } from './api'
import { CashDialog } from './CashDialog'

function Values({ values }: { values: CashValues }) {
  return <dl className="manual-values">{[['Shop Cash', values.shopCashAmount], ['Boss Added', values.bossAddedAmount], ['Total Collected', values.totalCollected]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatPKR(Number(value))}</dd></div>)}<div><dt>Notes</dt><dd>{values.notes || 'None'}</dd></div></dl>
}
function timestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Not recorded'
}
export function CashRecordDetails({ recordId, onClose, onCorrect }: { recordId: string; onClose: () => void; onCorrect?: (date: string) => void }) {
  const [page, setPage] = useState(1)
  const query = useCashQuery<CashDetails>('/records/' + recordId + '?page=' + page), record = query.data?.record
  return <CashDialog title="Daily Cash Details" onClose={onClose} footer={<><Button onClick={onClose}>Close</Button>{record && record.status !== 'voided' && onCorrect && <Button onClick={() => { onCorrect(record.businessDate); onClose() }}>Edit Record</Button>}</>}>
    {query.isPending && <LoadingSpinner showLabel label="Loading saved record and audit history?" />}
    {query.isError && <p role="alert">{cashErrorMessage(query.error)} <Button onClick={() => void query.refetch()}>Retry</Button></p>}
    {query.data && record && <><h3>{record.businessDate} ? {record.status === 'voided' ? 'Voided' : 'Active'} ? revision {record.revision}</h3><Values values={record} />
      <dl className="manual-values"><div><dt>Business Date</dt><dd>{record.businessDate}</dd></div><div><dt>Record Status</dt><dd>{record.status === 'voided' ? 'Voided' : 'Active'}</dd></div><div><dt>Entered By</dt><dd>{record.enteredBy?.name ?? 'Former operator'}</dd></div><div><dt>Created At</dt><dd>{timestamp(record.createdAt)}</dd></div><div><dt>Last Modified By</dt><dd>{record.lastUpdatedBy?.name ?? 'Former operator'}</dd></div><div><dt>Last Modified At</dt><dd>{timestamp(record.updatedAt)}</dd></div></dl>
      {record.status === 'voided' && <p>Voided by {record.voidedBy?.name ?? 'Former operator'} ? {timestamp(record.voidedAt)} ? {record.voidReason}</p>}
      <h3>Correction Audit</h3>{query.data.audit.map(row => <article className="manual-audit" key={row._id}><h4>{row.action === 'create' ? 'Original saved entry' : row.action === 'void' ? 'Record voided' : row.action === 'replace' ? 'Audited replacement' : 'Correction ' + row.revision}</h4><p>{row.reason}</p><p>{row.modifiedBy?.name ?? 'Former operator'} ? {timestamp(row.createdAt)}</p>{row.previous && <><strong>Previous values</strong><Values values={row.previous} /></>}<strong>Saved values</strong><Values values={row.next} /><p>Status: {row.previous?.status ?? 'active'} ? {row.next.status ?? 'active'}</p></article>)}
      <div className="cash-pagination"><Button disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous Audit</Button><span>Page {page}</span><Button disabled={page * query.data.limit >= query.data.total || query.isFetching} onClick={() => setPage(page + 1)}>Next Audit</Button></div></>}
  </CashDialog>
}
