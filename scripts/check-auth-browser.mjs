// Offline UI check: isolated Edge profile, built frontend, localhost API fixtures only.
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const profile = await mkdtemp(path.join(tmpdir(), 'tea-auth-browser-'))
const session = { user: { id: 'offline-owner', shopId: 'offline-shop', name: 'Offline Owner', email: 'owner@example.invalid', role: 'owner', shopName: 'Offline Shop' }, csrfToken: 'offline-only', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), absoluteExpiresAt: new Date(Date.now() + 180 * 86400000).toISOString(), serverTime: new Date().toISOString(), persistent: true, authorizationRequired: true }
let signedIn = false
let sessionUnavailable = false
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname.startsWith('/api/')) {
    let body = ''
    for await (const chunk of req) body += chunk
    const data = body ? JSON.parse(body) : {}
    let result = {}
    let status = 200
    if (pathname.endsWith('/auth/session') || pathname.endsWith('/auth/session/renew')) {
      const hasCookie = req.headers.cookie?.includes('offline-browser-session=fixture')
      status = sessionUnavailable ? 503 : hasCookie ? 200 : 401
      result = status === 200 ? session : {}
    }
    else if (pathname.endsWith('/auth/login')) {
      signedIn = data.password === 'offline passphrase'
      assert.equal(data.trustedDevice, true, 'Trusted device must be an explicit login choice')
      status = signedIn ? 200 : 401; result = signedIn ? session : {}
      if (signedIn) res.setHeader('Set-Cookie', 'offline-browser-session=fixture; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax')
    } else if (pathname.endsWith('/auth/account')) result = { ...session.user, status: 'active', passwordChangedAt: null, emailVerifiedAt: null, pendingEmail: null, emailChangeAvailable: false, sessions: [{ current: true, createdAt: new Date().toISOString(), expiresAt: session.expiresAt, accessMode: 'individual' }] }
    else if (pathname.endsWith('/auth/change-email')) { status = 503; result = { message: 'Email delivery is not configured. Your current sign-in email is unchanged.' } }
    else if (pathname.includes('/notifications')) { status = 503; result = { message: 'Notifications unavailable in the offline authentication fixture.' } }
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); return
  }
  try {
    const relative = pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html'
    const data = await readFile(path.join(dist, relative))
    res.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(data)
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const edge = process.env.EDGE_BINARY ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const launch = () => spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let browser = launch()
let socket
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  let port
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await delay(100) }
  }
  assert.ok(port, 'Isolated Edge did not start')
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let sequence = 0
  const pending = new Map()
  const browserErrors = []
  const receive = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task?.reject(new Error(message.error.message)) : task?.resolve(message.result) }
  }
  socket.onmessage = receive
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 10000)
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100) }
    const content = await evaluate("document.body.innerText.slice(0, 2500)")
    throw new Error(`Browser condition timed out: ${expression}; fixture page: ${content}; errors: ${browserErrors.join('\n')}`)
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: `${origin}/login` })
  await waitFor("!!document.querySelector('input[type=email]') && !document.querySelector('button[type=submit]').disabled")
  for (const width of [375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Login overflow at ${width}px`)
  }
  await evaluate(`(() => { const input = document.querySelector('input[autocomplete="current-password"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, 'offline passphrase'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate("document.querySelector('[aria-label=\"Show password\"]').click()")
  assert.equal(await evaluate("document.querySelector('input[autocomplete=\"current-password\"]').type"), 'text')
  assert.equal(await evaluate("document.querySelector('input[autocomplete=\"current-password\"]').value"), 'offline passphrase')
  await evaluate("document.querySelector('[aria-label=\"Hide password\"]').click()")
  await evaluate("document.querySelector('.auth-trusted-device input').click()")
  await evaluate(`(() => { const input = document.querySelector('input[type="email"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, 'owner@example.invalid'); input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`)
  await waitFor("location.pathname === '/dashboard'")
  assert.equal(signedIn, true, 'Login must reach the fixture backend before navigation')
  await send('Page.navigate', { url: `${origin}/settings` })
  await waitFor("!!document.querySelector('#account-security .account-details')")
  for (const width of [375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Settings overflow at ${width}px`)
  }
  await waitFor("!!document.querySelector('#security [aria-label=\"Show new password\"]')")
  await evaluate(`(() => { const input = document.querySelectorAll('#security input')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'new offline passphrase'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate("document.querySelector('#security [aria-label=\"Show new password\"]').click()")
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#security input')).map(input => input.type)"), ['password', 'text', 'password'])
  assert.equal(await evaluate("document.querySelectorAll('#security input')[1].value"), 'new offline passphrase')
  await evaluate("document.querySelector('#security [aria-label=\"Hide new password\"]').click()")
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#security input')).map(input => input.type)"), ['password', 'password', 'password'])
  assert.equal(await evaluate("document.querySelector('#sign-in-email input[readonly]').value"), session.user.email)
  assert.equal(await evaluate("document.cookie.includes('offline-browser-session')"), false, 'Session cookie must be HttpOnly')
  sessionUnavailable = true
  await evaluate("window.dispatchEvent(new Event('focus'))")
  await waitFor("!!document.querySelector('.auth-connection-banner')")
  assert.equal(await evaluate("document.querySelectorAll('#security input')[1].value"), 'new offline passphrase', 'Recheck failure must preserve mounted form values')
  sessionUnavailable = false
  await evaluate("document.querySelector('.auth-connection-banner button').click()")
  await waitFor("!document.querySelector('.auth-connection-banner')")
  assert.equal(await evaluate("document.querySelectorAll('#security input')[1].value"), 'new offline passphrase', 'Recovery must not remount the form')
  const exited = once(browser, 'exit')
  await send('Browser.close')
  await Promise.race([exited, delay(5000)])
  socket.close()
  await rm(path.join(profile, 'DevToolsActivePort'), { force: true })
  browser = launch()
  let reopenedPort
  for (let i = 0; i < 100; i++) {
    try { reopenedPort = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await delay(100) }
  }
  assert.ok(reopenedPort, 'Browser did not reopen')
  const reopenedTarget = await (await fetch(`http://127.0.0.1:${reopenedPort}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(reopenedTarget.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = receive
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: `${origin}/settings` })
  await waitFor("!!document.querySelector('#account-security .account-details')")
  assert.equal(await evaluate("document.querySelector('#sign-in-email input[readonly]').value"), session.user.email)
  console.log('PASS: real Edge; trusted opt-in; persistent HttpOnly fixture cookie survives browser close/reopen; refresh restoration; outage/recovery retains entered values; independent password toggles; no horizontal overflow at 375/768/1440px. Local fixtures only; no live database or email.')
} finally {
  socket?.close(); browser.kill()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  // The profile is a unique directory allocated above under the OS temp directory.
  await delay(500)
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(profile).startsWith('tea-auth-browser-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
  }
}
