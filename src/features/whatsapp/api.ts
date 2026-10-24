import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'
export type Contact = { customerName: string; existingPhone: string; phone: string; optedIn: boolean; consentSource: string; consentAt: string | null; optedOutAt: string | null; revision: number }
export class WhatsAppApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function whatsappRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/whatsapp${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new WhatsAppApiError(payload?.message ?? 'WhatsApp request failed. Retry.', response.status)
  return payload as T
}
export function chatTime(value: string) { return new Date(value).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }) }
