import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const handlers = new Map()
  const tab = { url: 'https://dashboard.example.invalid/login', navigate: vi.fn().mockResolvedValue(), focus: vi.fn().mockResolvedValue() }
  const self = { addEventListener: (name, handler) => handlers.set(name, handler),
    location: { origin: 'https://dashboard.example.invalid' },
    registration: { showNotification: vi.fn().mockResolvedValue() },
    clients: { matchAll: vi.fn().mockResolvedValue([tab]), openWindow: vi.fn() } }
  new Function('self', readFileSync(new URL('../../../public/collection-sw.js', import.meta.url), 'utf8'))(self)
  return { self, handlers, tab }
}
describe('privacy-preserving notification worker', () => {
  it('uses fixed public text and never caches authenticated responses', async () => {
    const { self, handlers } = worker()
    let pending
    handlers.get('push')({ waitUntil: value => { pending = value }, data: { json: () => ({ customer: 'private', balance: 20000 }) } })
    await pending
    expect(self.registration.showNotification.mock.calls[0][0]).toBe('Khata Collection Due')
    expect(JSON.stringify(self.registration.showNotification.mock.calls)).not.toContain('private')
    expect(handlers.has('fetch')).toBe(false)
  })
  it('focuses the dashboard protected route with no customer or token in the URL', async () => {
    const { handlers, tab } = worker()
    let pending
    handlers.get('notificationclick')({ notification: { close: vi.fn() }, waitUntil: value => { pending = value } })
    await pending
    expect(tab.navigate).toHaveBeenCalledWith('https://dashboard.example.invalid/dashboard#khata-collections')
    expect(tab.focus).toHaveBeenCalledOnce()
  })
})
