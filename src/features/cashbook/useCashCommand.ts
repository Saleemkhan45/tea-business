import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../auth/auth.store'
import { CashApiError, cashErrorMessage, cashRequest, confirmedCashDay, definitiveCashFailure, refreshConfirmedCash, type CashDay } from './api'

type Command = { path: string; body: object; method: string; businessDate: string; recordId?: string; status?: 'active' | 'voided' }

// Every manual cash write uses a frozen request/key until its outcome is known.
export function useCashCommand(onConfirmed: (message: string) => void) {
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState(''), [duplicate, setDuplicate] = useState(false)
  const sending = useRef(false), unknown = useRef(false), pending = useRef<(Command & { body: object }) | null>(null)
  const client = useQueryClient(), user = useAuthStore(state => state.session?.user)

  async function submit(command: Command, success: string) {
    if (sending.current) return
    setError(''); setDuplicate(false)
    if (!pending.current) pending.current = { ...command, body: { ...command.body, key: crypto.randomUUID() } }
    const request = pending.current
    sending.current = true; setBusy(true)
    try {
      const result = await cashRequest<{ record: CashDay; replayed: boolean; postedRevision: number }>(request.path, request.body, request.method)
      const record = result.record
      if (!confirmedCashDay(record) || record.businessDate !== request.businessDate || (request.recordId && record._id !== request.recordId)
        || !Number.isSafeInteger(result.postedRevision) || result.postedRevision < 0 || result.postedRevision > record.revision
        || ((result.postedRevision === record.revision || !result.replayed) && (record.status ?? 'active') !== (request.status ?? 'active'))) throw new CashApiError('The backend did not acknowledge a valid saved manual record. Retry the same request.', 502)
      pending.current = null; unknown.current = false; setUncertain(false)
      const warning = await refreshConfirmedCash(client, user, record)
      onConfirmed(`${result.replayed ? 'This request was already confirmed. Current figures reflect the latest saved revision.' : success}${warning}`)
    } catch (issue) {
      const definitive = definitiveCashFailure(issue, unknown.current)
      if (definitive) pending.current = null
      else unknown.current = true
      setUncertain(!definitive)
      setDuplicate(issue instanceof CashApiError && issue.code === 'MANUAL_CASH_DAY_EXISTS' && definitive)
      setError(`${cashErrorMessage(issue)}${!definitive ? ' The outcome may be unknown. Retry the same request; do not enter it again.' : ''}`)
    } finally { sending.current = false; setBusy(false) }
  }
  return { submit, busy, uncertain, error, setError, duplicate }
}
