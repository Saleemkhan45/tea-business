import { afterEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../auth/auth.api', () => ({ API_BASE_URL: '/api/v1', authenticatedFetch: auth.fetch }))
import { disablePhonePush, enablePhonePush } from './push'

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
function browser(permission = 'granted') {
  const subscription = { endpoint: 'https://fcm.googleapis.com/offline', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/offline', keys: {} }), unsubscribe: vi.fn().mockResolvedValue(true) }
  const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe: vi.fn() } }
  const serviceWorker = { register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(registration) }
  const requestPermission = vi.fn().mockResolvedValue(permission)
  vi.stubGlobal('window', { isSecureContext: true, PushManager: {}, Notification: {} })
  vi.stubGlobal('navigator', { serviceWorker })
  vi.stubGlobal('Notification', { requestPermission })
  return { requestPermission, serviceWorker, subscription }
}
describe('user-initiated phone notifications', () => {
  it('does not register a worker or store a subscription after permission denial', async () => {
    const state = browser('denied')
    await expect(enablePhonePush('offline-public-key')).rejects.toThrow('denied')
    expect(state.serviceWorker.register).not.toHaveBeenCalled()
    expect(auth.fetch).not.toHaveBeenCalled()
  })
  it('registers only on explicit enable and uses the authenticated API', async () => {
    const state = browser()
    expect(state.requestPermission).not.toHaveBeenCalled()
    auth.fetch.mockResolvedValueOnce(new Response('{"subscribed":true}'))
    await enablePhonePush('offline-public-key')
    expect(state.serviceWorker.register).toHaveBeenCalledWith('/collection-sw.js', { scope: '/' })
    expect(auth.fetch).toHaveBeenCalledWith('/api/v1/notifications/collections/push', expect.objectContaining({ method: 'POST' }))
  })
  it('deactivates the server subscription before removing the browser subscription', async () => {
    const state = browser()
    auth.fetch.mockResolvedValueOnce(new Response('{"subscribed":false}'))
    await disablePhonePush()
    expect(state.subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(auth.fetch.mock.calls[0][1].method).toBe('DELETE')
  })
  it('explains unsupported platforms without requesting permission', async () => {
    vi.stubGlobal('window', { isSecureContext: false })
    await expect(enablePhonePush('key')).rejects.toThrow('Home Screen')
    expect(auth.fetch).not.toHaveBeenCalled()
  })
})
