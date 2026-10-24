import type { AuthUser } from './auth.store'
import { useAuthStore } from './auth.store'

export function scopedKey<T extends readonly unknown[]>(key: T, user: Pick<AuthUser, 'id' | 'shopId'> | null | undefined) {
  // Keep the established resource prefixes so existing mutation invalidation works.
  return [...key, { shopId: user?.shopId ?? null, userId: user?.id ?? null }] as const
}

export function useScopedQueryKey<T extends readonly unknown[]>(key: T) {
  const user = useAuthStore(state => state.session?.user)
  return scopedKey(key, user)
}
