// Browser-only fault injection layered over the existing isolated performance fixtures.
export function installReliabilityFixtures() {
  const base = window.fetch
  const state = window.__reliability = { offline: false, sessionStatus: location.search.includes('startup-outage') ? 503 : 200, sessionDelay: 80, dashboardFailures: 0, widgetFailure: false, salesPkr: 10000, attempts: [] }
  window.fetch = async (input, init = {}) => {
    const path = new URL(String(input), location.origin).pathname
    const method = init.method || 'GET'
    const attempt = { path, method, startedAt: performance.now(), key: init.body ? JSON.parse(String(init.body)).key : undefined }
    state.attempts.push(attempt)
    const delay = ms => new Promise((resolve, reject) => {
      if (init.signal?.aborted) return reject(new DOMException('Canceled', 'AbortError'))
      const cancel = () => { clearTimeout(timer); reject(new DOMException('Canceled', 'AbortError')) }
      const timer = setTimeout(() => { init.signal?.removeEventListener('abort', cancel); resolve() }, ms)
      init.signal?.addEventListener('abort', cancel, { once: true })
    })
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(status === 429 ? { 'Retry-After': '1' } : {}) } })
    try {
      await delay(20)
      if (state.offline) throw new TypeError('Offline fixture server')
      let result
      if (path.endsWith('/auth/session')) {
        await delay(state.sessionDelay)
        if (state.sessionStatus !== 200) result = json({ message: 'Fixture session response' }, state.sessionStatus)
      }
      if (path.endsWith('/sales/dashboard') && state.dashboardFailures > 0) { state.dashboardFailures--; result = json({ message: 'Fixture transient database failure' }, 503) }
      if (path.endsWith('/sales/top-products') && state.widgetFailure) result = json({ message: 'Fixture product widget failure' }, 503)
      if (path.endsWith('/sales')) result = json({ sales: [] })
      if (path.endsWith('/sales/entry-options')) result = json({ operator: { id: '507f1f77bcf86cd799439003', name: 'Offline Owner', role: 'owner' }, items: [] })
      result ??= await base(input, init)
      if (path.endsWith('/sales/dashboard') && result.ok) {
        const data = await result.json(); data.metrics.salesPkr = state.salesPkr
        result = json(data)
      }
      attempt.status = result.status
      return result
    } catch (error) { attempt.status = 0; throw error } finally { attempt.durationMs = performance.now() - attempt.startedAt }
  }
}
