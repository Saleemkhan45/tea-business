// Deliberately no fetch handler or authenticated response cache.
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Khata Collection Due', {
    body: 'You have a scheduled collection. Open your dashboard to review.',
    tag: 'tea-khata-collections', icon: '/favicon.svg',
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  // Fixed same-origin destination; no customer data or tokens in payloads/URLs.
  const url = new URL('/dashboard#khata-collections', self.location.origin).href
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const tab = tabs.find(client => new URL(client.url).origin === self.location.origin)
    if (tab) { await tab.navigate(url); await tab.focus() }
    else await self.clients.openWindow(url)
  })())
})
