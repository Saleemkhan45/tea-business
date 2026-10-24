import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'

export type Schedule = {
  frequency?: 'weekly' | 'one_time'; channels?: ('in_app' | 'push' | 'whatsapp' | 'customer_whatsapp')[]
  weekdays: number[]; expectedAmount: number; time: string; startDate: string; endDate: string
  notes: string; status: 'active' | 'paused' | 'disabled'; revision: number
}
export type Collection = {
  id: string; customerId: string; customerName: string; phone?: string; balance: number
  scheduledDate: string; expectedAmount: number; receivedAmount: number; unpaidAmount: number
  status: string; projected?: boolean; paymentIds: string[]
  lastPaymentDate?: string | null; lastPaymentAmount?: number | null
}
export type CollectionResult = {
  rows: Collection[]; total: number
  totals: { expected: number; received: number; unpaid: number; collected: number; partial: number; overdue: number }
}
export async function collectionRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/collections${path}`, {
    method: body ? 'PUT' : 'GET', signal, headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.issues?.[0]?.message ?? payload?.message ?? 'Unable to load collections. Retry.')
  }
  return response.json() as Promise<T>
}
