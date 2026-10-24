import { API_BASE_URL, authenticatedFetch } from '../auth/auth.api'

export async function deliveryRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/notifications/collections${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.message ?? 'Notification setup failed. Retry.')
  return result as T
}
export function pushSupport() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator
    && 'PushManager' in window && 'Notification' in window
}
function vapidBytes(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0))
}
// Call only from a direct click. No permission request runs at startup.
export async function enablePhonePush(publicKey: string) {
  if (!pushSupport()) throw new Error('Push is unavailable here. Use HTTPS or localhost. On supported iPhones/iPads, add this app to the Home Screen and open it there.')
  if (!publicKey) throw new Error('Phone notifications require server VAPID setup.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was denied. You can change it in browser or device settings.')
  const registration = await navigator.serviceWorker.register('/collection-sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) })
  const json = subscription.toJSON()
  await deliveryRequest('/push', 'POST', { endpoint: json.endpoint, keys: json.keys })
}
export async function disablePhonePush() {
  if (!pushSupport()) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await deliveryRequest('/push', 'DELETE', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
