// Standalone browser fixture only; never imported by application code.
export function installAccessFixtures() {
  const base = window.fetch, staff = new URLSearchParams(location.search).has('staff')
  let approved, sequence = 0, firstSession = true
  window.__authorizationRequests = 0; window.__mutationRequests = 0
  window.fetch = async (url, init = {}) => {
    const path = new URL(String(url), location.origin).pathname
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (path.endsWith('/notifications/settings')) return json({ enabled: { LOW_STOCK: true, PURCHASE_ADDED: true, SALES_UP: true, NO_PAYMENT_TODAY: true, KHATA_COLLECTION: true, WHATSAPP_MESSAGE: true }, lowStockThresholds: [], soundEnabled: false, noPaymentCutoffTime: '18:00', muteUntil: null })
    if (path.includes('/notifications/collections/') || path.includes('/whatsapp/')) return json({ message: 'Optional delivery integration is not part of this isolated fixture.' }, 503)
    if (path.endsWith('/auth/session') || path.endsWith('/auth/staff-session')) {
      if (staff && firstSession) { firstSession = false; return json({ trustedViewingAvailable: true }, 401) }
      const result = await base('/api/v1/auth/session').then(response => response.json())
      return json({ ...result, authorizationRequired: true, accessMode: staff ? 'trusted-view' : 'individual' })
    }
    if (path.endsWith('/auth/authorize')) {
      window.__authorizationRequests++
      const body = JSON.parse(init.body)
      if (body.password !== 'offline fixture passphrase') return json({ message: 'Password authorization failed.' }, 403)
      approved = { token: (++sequence).toString(16).padStart(64, '0'), payload: JSON.stringify(body.payload) }
      return json({ token: approved.token, expiresAt: new Date(Date.now() + 60000).toISOString() })
    }
    if (path.endsWith('/auth/change-password')) {
      const body = JSON.parse(init.body)
      if (body.currentPassword !== 'offline fixture passphrase') return json({ message: 'Current password is incorrect.' }, 403)
      return json({ changed: true, signInRequired: true })
    }
    if (path.endsWith('/cashbook/records') && init.method === 'POST') {
      window.__mutationRequests++
      const token = new Headers(init.headers).get('x-action-authorization')
      if (!approved || token !== approved.token || init.body !== approved.payload) return json({ message: 'Authorization required.' }, 403)
      approved = null
    }
    return base(url, init)
  }
}
