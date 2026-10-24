import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, AuthApiError, authenticatedFetch } from './auth.api'
import { useAuthStore, type AuthSession } from './auth.store'

export const accountSchema = z.object({
  name: z.string(), email: z.string().email(), role: z.enum(['owner', 'admin', 'staff']), status: z.enum(['active', 'inactive']),
  updatedAt: z.iso.datetime().nullable().optional(), passwordChangedAt: z.iso.datetime().nullable(), emailVerifiedAt: z.iso.datetime().nullable(),
  pendingEmail: z.object({ email: z.string().email(), expiresAt: z.iso.datetime() }).nullable(), emailChangeAvailable: z.boolean(),
  sessions: z.array(z.object({ current: z.boolean(), handle: z.string().optional(), persistent: z.boolean().optional(), absoluteExpiresAt: z.iso.datetime().optional(), createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), accessMode: z.enum(['individual', 'trusted-view']) })),
})
export function accountSecurityKey(session: AuthSession | null, revision: number) {
  return ['account-security', { shopId: session?.user.shopId ?? null, userId: session?.user.id ?? null, revision }] as const
}
export async function accountSecurityRequest(path = '/account', body?: object, method = body ? 'POST' : 'GET', signal?: AbortSignal): Promise<unknown> {
  const response = await authenticatedFetch(`${API_BASE_URL}/auth${path}`, { method, ...(signal ? { signal } : {}), headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const payload = z.object({ message: z.string() }).safeParse(result)
    throw new AuthApiError(payload.success ? payload.data.message : response.status === 401 ? 'Your session expired. Sign in again.' : response.status >= 500 ? 'Account security is temporarily unavailable. Please retry.' : 'The request could not be completed.', response.status)
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new AuthApiError('The account response could not be verified. Check your account before trying again.', 502, 'invalid-response', method !== 'GET')
  return result
}
export function useAccountSecurity() {
  const session = useAuthStore(state => state.session), revision = useAuthStore(state => state.revision)
  const canManageAccount = ['owner', 'admin'].includes(session?.user.role ?? '') && session?.accessMode !== 'trusted-view'
  return useQuery({ queryKey: accountSecurityKey(session, revision), enabled: canManageAccount, retry: false, staleTime: 15000,
    queryFn: async ({ signal }) => {
      const result = accountSchema.safeParse(await accountSecurityRequest('/account', undefined, 'GET', signal))
      if (!result.success) throw new Error('The server returned invalid account details. Refresh or contact your administrator.')
      return result.data
    } })
}
export const securityDate = (value?: string | null) => value ? new Date(value).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'
