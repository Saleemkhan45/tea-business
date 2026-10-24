// Synthetic values for isolated browser checks only. Never imported by the app.
export function installPerformanceFixtures() {
  // Realtime transport is outside this check. Prevent native WebSocket handshakes;
  // the CDP harness separately blocks every external HTTP/XHR request.
  window.WebSocket = class extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3
    readyState = 3
    constructor() { super(); setTimeout(() => this.onerror?.(new Event('error')), 0) }
    close() {}
    send() {}
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = name => parts.find(row => row.type === name).value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const operator = { _id: '507f1f77bcf86cd799439003', name: 'Offline Owner' }
  const session = { user: { id: operator._id, name: operator.name, email: 'offline@example.invalid', role: 'owner', shopId: '507f1f77bcf86cd799439009', shopName: 'Offline' }, csrfToken: 'offline', expiresAt: new Date(Date.now() + 3600000).toISOString() }
  const region = { _id: '507f1f77bcf86cd799439001', name: 'Offline Region', status: 'active' }
  const delay = ms => new Promise(done => setTimeout(done, ms))
  const params = new URLSearchParams(location.search), waiting = []
  window.__holdDashboard = params.has('hold')
  window.__releaseDashboard = () => { window.__holdDashboard = false; waiting.splice(0).forEach(done => done()) }
  window.__requests = []; window.__records = []; window.__mode = params.has('failure') ? 'failure' : 'ok'; window.__firstKpi = null; window.__shell = null; window.__shifts = []; window.__longTasks = []
  new PerformanceObserver(list => { for (const row of list.getEntries()) if (!row.hadRecentInput) window.__shifts.push(row.value) }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver(list => { for (const row of list.getEntries()) window.__longTasks.push(row.duration) }).observe({ type: 'longtask', buffered: true })
  const observer = new MutationObserver(() => {
    if (window.__shell === null && document.querySelector('.dashboard-title')) window.__shell = performance.now()
    if (window.__firstKpi === null && document.querySelector('.stats-grid .stat-value')?.textContent.includes('2')) window.__firstKpi = performance.now()
  })
  observer.observe(document, { childList: true, subtree: true, characterData: true })
  window.fetch = async (url, init = {}) => {
    const u = new URL(String(url), location.origin), path = u.pathname, started = performance.now()
    let body, status = 200
    if (!path.startsWith('/api/v1/')) throw new Error('External fixture request blocked: ' + path)
    const method = init.method || 'GET'
    if (path.endsWith('/auth/session')) { await delay(40); body = session }
    else if (path.endsWith('/auth/logout')) { status = 204 }
    else if (path.endsWith('/sales/dashboard')) {
      if (window.__holdDashboard) await new Promise(done => waiting.push(done))
      await delay(120)
      if (window.__mode === 'failure') { status = 500; body = { message: 'Fixture server error' } }
      else if (window.__mode === 'unauthorized') { status = 401; body = { message: 'Fixture expired session' } }
      else body = { from: u.searchParams.get('from'), to: u.searchParams.get('to'), regionId: u.searchParams.get('regionId'), metrics: { orders: 2, salesPkr: 10000, averageOrderPkr: 5000, stockKg: 10, creditSalesPkr: 3000 }, daily: Array.from({ length: Math.round((Date.parse(u.searchParams.get('to')) - Date.parse(u.searchParams.get('from'))) / 86400000) + 1 }, (_, index) => { const date = new Date(Date.parse(u.searchParams.get('from')) + index * 86400000).toISOString().slice(0, 10); return { date, salesPkr: date === today ? 10000 : 0 } }), categories: [{ label: 'green', orders: 2, percent: 100 }], recentSales: [], khata: { outstandingPkr: 3000, customers: 1, paymentsTodayPkr: 1000, today } }
    } else if (path.endsWith('/sales/top-products')) { await delay(500); body = { from: u.searchParams.get('from'), to: u.searchParams.get('to'), regionId: u.searchParams.get('regionId'), products: [{ productId: '507f1f77bcf86cd799439002', name: 'Offline Tea', quantityKg: 2 }] } }
    else if (path.endsWith('/regional/regions')) { await delay(80); body = { regions: [region] } }
    else if (path.endsWith('/regional/overview')) { await delay(160); body = { regions: [{ ...region, stockKg: 10, lowStockProducts: 0, orders: 2, quantityKg: 2, salesPkr: 10000 }] } }
    else if (path.endsWith('/cashbook/status')) { await delay(60); body = { ready: true, mode: 'manual_daily', today } }
    else if (path.endsWith('/cashbook/overview')) { await delay(60); body = { today: { date: today, record: window.__records[0] ?? null }, yesterday: { date: '2026-01-01', record: null } } }
    else if (path.includes('/cashbook/records/by-date/')) { await delay(60); body = { date: path.split('/').at(-1), record: window.__records[0] ?? null } }
    else if (path.endsWith('/cashbook/records') && method === 'POST') {
      await delay(120)
      const input = JSON.parse(init.body)
      const record = { _id: '507f1f77bcf86cd799439005', businessDate: input.businessDate, shopCashAmount: input.shopCashAmount, bossAddedAmount: input.bossAddedAmount, totalCollected: input.shopCashAmount + input.bossAddedAmount, notes: input.notes, revision: 0, enteredBy: operator, lastUpdatedBy: operator, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      window.__records = [record]; body = { record, replayed: false, postedRevision: 0 }
    } else if (path.endsWith('/cashbook/records')) {
      await delay(80)
      const rows = window.__records, record = rows[0]
      body = { rows, from: u.searchParams.get('from'), to: u.searchParams.get('to'), page: 1, limit: 20, total: rows.length, summary: { recordedDays: rows.length, shopCashAmount: record?.shopCashAmount ?? 0, bossAddedAmount: record?.bossAddedAmount ?? 0, totalCollected: record?.totalCollected ?? 0, averageDailyCollection: record?.totalCollected ?? null } }
    } else if (path.endsWith('/collections')) { await delay(180); body = { rows: [], total: 0, totals: { expected: 0, received: 0, unpaid: 0, collected: 0, partial: 0, overdue: 0 } } }
    else if (path.includes('/notifications')) body = path.endsWith('unread-count') ? { count: 0 } : { data: [], pagination: { page: 1, totalPages: 1, total: 0 } }
    else throw new Error('Unexpected fixture endpoint ' + path)
    const text = status === 204 ? null : JSON.stringify(body)
    window.__requests.push({ path: path + u.search, method, status, durationMs: performance.now() - started, bytes: text?.length ?? 0, finishedAt: performance.now() })
    return new Response(text, { status, headers: { 'Content-Type': 'application/json' } })
  }
}
