// Offline browser regression check: real component/CSS, in-memory API fixtures only.
// Run from any directory: node client/scripts/check-supplier-modal.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const browserPath = process.env.SUPPLIER_TEST_BROWSER ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
assert.ok(browserPath, 'Set SUPPLIER_TEST_BROWSER to a local Chrome/Edge executable.')
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module">
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddSupplierModal } from '/src/features/suppliers/components/AddSupplierModal.tsx';
import { acceptSession } from '/src/features/auth/auth.store.ts';
import '/src/style.css';
import '/src/features/sales/sales.css';
import '/src/features/sales/responsive.css';
import '/src/features/suppliers/suppliers.css';
import '/src/audit.css';
import '/src/theme.css';
const e = React.createElement;
window.__supplierWrites = [];
const regions = Array.from({length: 30}, (_, i) => ({ _id: String(i).padStart(24, '0'), name: i === 29 ? 'Karkhano' : i === 28 ? 'A very long service region name that must wrap without hiding its checkbox or causing horizontal overflow' : 'Fixture region ' + i, status: 'active' }));
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (options.method === 'POST' && path.endsWith('/purchases/suppliers')) {
    const input = JSON.parse(options.body); window.__supplierWrites.push(input);
    return new Response(JSON.stringify(window.__supplierWrites.length === 1 ? { message: 'Notes validation fixture: review the final field before saving.', issues: [{ path: 'notes', message: 'Review notes' }] } : { supplier: { ...input, _id: 'fixture-supplier', revision: 0 } }), { status: window.__supplierWrites.length === 1 ? 400 : 201, headers: { 'Content-Type': 'application/json' } });
  }
  if (path.endsWith('/regional/regions')) return new Response(JSON.stringify({regions}));
  if (path.endsWith('/regional/products')) return new Response(JSON.stringify({products: Array.from({length: 15}, (_, i) => ({ _id: 'p' + i, name: 'Fixture product ' + i, teaType: 'Green Tea', status: 'active' }))}));
  throw new Error('External API access blocked in offline supplier modal check: ' + path);
};
acceptSession({user: { id: 'fixture-operator', name: 'Offline operator', email: 'test@example.invalid', role: 'admin', shopId: 'fixture-shop', shopName: 'Fixture' }, csrfToken: 'offline-only', expiresAt: '2099-01-01T00:00:00Z'});
function Fixture() {
  const [open, setOpen] = useState(false);
  return e(React.Fragment, null, e('button', {id: 'open', onClick: () => setOpen(true)}, 'Add Supplier'), open && e(AddSupplierModal, {onClose: () => setOpen(false), onSave: () => {window.__saved = true; setOpen(false)}}));
}
createRoot(document.getElementById('app')).render(e(QueryClientProvider, {client: new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})}, e(Fixture)));
</script></body></html>`

const profile = await mkdtemp(join(tmpdir(), 'supplier-modal-check-'))
let server, browser, socket
const pending = new Map()
let sequence = 0
const delay = ms => new Promise(done => setTimeout(done, ms))
async function until(check, message) {
  const end = Date.now() + 20000
  while (Date.now() < end) { const result = await check(); if (result) return result; await delay(100) }
  throw new Error(message)
}
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)) }, 15000)
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject })
    socket.send(JSON.stringify({id, method, params}))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const frame = () => evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
const clickButton = text => evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`)
try {
  server = await createServer({root, server: {host: '127.0.0.1', port: 0}, logLevel: 'error', plugins: [{
    name: 'offline-supplier-modal-fixture',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__supplier-modal-check.html') return next()
        try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/__supplier-modal-check.html', html)) } catch (error) { next(error) }
      })
    },
  }]})
  await server.listen()
  const port = server.httpServer.address().port
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--in-process-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true})
  browser.stderr.on('data', data => { if (process.env.SUPPLIER_TEST_DEBUG) process.stderr.write(data) })
  browser.on('error', error => { console.error(error.message) })
  const devtools = await until(async () => { try { return await readFile(join(profile, 'DevToolsActivePort'), 'utf8') } catch { return null } }, 'Browser did not start')
  const debugPort = devtools.split('\n')[0]
  const targets = await fetch('http://127.0.0.1:' + debugPort + '/json/list').then(response => response.json())
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  socket.addEventListener('message', event => {
    if (process.env.SUPPLIER_TEST_DEBUG) console.log('CDP', String(event.data).slice(0, 500))
    const data = JSON.parse(event.data)
    if (data.method === 'Runtime.exceptionThrown') console.error('Browser exception:', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description)
    const message = JSON.parse(event.data), handler = pending.get(message.id)
    if (handler) { pending.delete(message.id); message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result) }
  })
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}) })
  await send('Page.enable')
  await send('Runtime.enable')
  for (const width of [375, 768, 1366]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 768, deviceScaleFactor: 1, mobile: false})
    await send('Page.navigate', {url: 'http://127.0.0.1:' + port + '/__supplier-modal-check.html'})
    await until(() => evaluate('Boolean(document.querySelector("#open"))'), 'Fixture did not load')
    await evaluate('document.querySelector("#open").focus(); document.querySelector("#open").click()')
    await until(() => evaluate('document.querySelectorAll(".supplier-options input[type=checkbox]").length === 45'), 'Region/product options did not load')
    const initial = await evaluate(`(() => {
      const modal = document.querySelector('.supplier-modal'), body = document.querySelector('.supplier-form-body'), footer = modal.querySelector('footer'), header = modal.querySelector('header');
      const bounds = element => {const rect = element.getBoundingClientRect(); return {top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right}};
      return {modal: bounds(modal), body: bounds(body), footer: bounds(footer), header: bounds(header), scrollable: body.scrollHeight > body.clientHeight, bodyOverflow: getComputedStyle(body).overflowY, formOverflow: getComputedStyle(modal.querySelector('form')).overflowY, footerPosition: getComputedStyle(footer).position, columns: getComputedStyle(modal.querySelector('.form-grid')).gridTemplateColumns.split(' ').length, backgroundLocked: document.body.style.overflow === 'hidden', horizontalOverflow: body.scrollWidth > body.clientWidth, optionsOverflow: [...document.querySelectorAll('.supplier-options')].map(node => getComputedStyle(node).overflowY), fields: [...modal.querySelectorAll('input, textarea, select')].length};
    })()`)
    assert.ok(initial.scrollable && initial.bodyOverflow === 'auto', 'Form body must scroll at ' + width)
    assert.equal(initial.formOverflow, 'hidden')
    assert.equal(initial.footerPosition, 'static')
    assert.equal(initial.columns, width < 600 ? 1 : 2)
    assert.ok(initial.backgroundLocked && !initial.horizontalOverflow)
    assert.ok(initial.body.bottom <= initial.footer.top + 1)
    assert.ok(initial.modal.left >= 0 && initial.modal.right <= width)
    assert.ok(initial.optionsOverflow.every(value => value === 'visible'), 'Checkbox groups must not nest scrolling')
    assert.equal(initial.fields, 56)
    const region = await evaluate(`(() => {
      const label = [...document.querySelectorAll('.supplier-options label')].find(node => node.textContent === 'Karkhano');
      label.scrollIntoView({block: 'center'}); const input = label.querySelector('input'); input.focus();
      const rect = label.getBoundingClientRect(), body = document.querySelector('.supplier-form-body').getBoundingClientRect(), footer = document.querySelector('.supplier-modal footer').getBoundingClientRect();
      return {top: rect.top, bottom: rect.bottom, bodyTop: body.top, bodyBottom: body.bottom, footerTop: footer.top};
    })()`)
    assert.ok(region.top >= region.bodyTop && region.bottom <= region.bodyBottom && region.bottom <= region.footerTop, 'Last region must be fully visible')
    await send('Input.dispatchKeyEvent', {type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32})
    await send('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32})
    await evaluate(`document.querySelector('.supplier-form-body').scrollTop = 0`)
    await frame()
    assert.equal(await evaluate(`[...document.querySelectorAll('.supplier-options label')].find(node => node.textContent === 'Karkhano').querySelector('input').checked`), true)
    // Manual offerings remain descriptions; reject normalized duplicates before API access.
    await evaluate(`(() => { const input = document.querySelector('.supplier-offerings input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ' Green   Tea '); input.dispatchEvent(new Event('input', {bubbles:true})); })()`)
    await clickButton('+ Add Another Product')
    await evaluate(`(() => { const input = document.querySelectorAll('.supplier-offerings input')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'green tea'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`)
    // Product search preserves a selected region and keeps the matching product interactive.
    await evaluate(`(() => {const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = document.querySelector('input[required]'); set.call(name, 'Offline supplier'); name.dispatchEvent(new Event('input', {bubbles: true})); const search = document.querySelector('input[aria-label="Search catalog products"]'); set.call(search, 'Fixture product 14'); search.dispatchEvent(new Event('input', {bubbles: true}));})()`)
    await until(() => evaluate('document.querySelectorAll(".supplier-options input[type=checkbox]").length === 31'), 'Product search did not filter')
    await evaluate(`document.querySelectorAll('.supplier-options')[1].querySelector('input[type=checkbox]').click()`)
    await clickButton('Save Supplier')
    await until(() => evaluate('document.querySelector(".form-error-banner")?.textContent.includes("unique")'), 'Duplicate manual offering was not rejected')
    assert.equal(await evaluate('window.__supplierWrites.length'), 0)
    await evaluate(`document.querySelector('[aria-label="Remove product 2"]').click()`)
    await frame()
    await clickButton('Save Supplier')
    await until(() => evaluate('document.querySelector(".form-error-banner")?.textContent.includes("Review notes")'), 'API validation error was not rendered')
    assert.deepEqual(await evaluate('window.__supplierWrites[0].productOfferings'), ['Green Tea'])
    assert.equal(await evaluate('typeof window.__supplierWrites[0].creationIdempotencyKey'), 'string')
    await frame()
    const final = await evaluate(`(() => {
      const body = document.querySelector('.supplier-form-body'), footer = document.querySelector('.supplier-modal footer'), header = document.querySelector('.supplier-modal header'), error = document.querySelector('.form-error-banner');
      const bounds = element => {const r = element.getBoundingClientRect(); return {top:r.top, bottom:r.bottom}};
      return {header:bounds(header), footer:bounds(footer), error:bounds(error), body:bounds(body), selected:[...document.querySelectorAll('.supplier-options label')].find(node => node.textContent === 'Karkhano').querySelector('input').checked, notes:Boolean(document.querySelector('textarea[maxlength="2000"]')), writes:window.__supplierWrites.length};
    })()`)
    assert.ok(final.notes && final.selected && final.writes === 1)
    assert.ok(final.error.top >= final.body.top && final.error.bottom <= final.footer.top + 1, 'Final validation error must be visible above footer')
    assert.ok(Math.abs(final.footer.top - initial.footer.top) < 1 && Math.abs(final.header.top - initial.header.top) < 1, 'Header/footer must remain stationary')
    // Tab at the footer wraps to the close control; Escape closes and restores focus.
    await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent === 'Save Supplier').focus()`)
    await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9})
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Close supplier form')
    await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27})
    await until(() => evaluate('!document.querySelector(".supplier-modal")'), 'Escape did not close')
    assert.equal(await evaluate('document.activeElement.id'), 'open')
    assert.equal(await evaluate('document.body.style.overflow'), '')
    await clickButton('Add Supplier')
    await clickButton('Cancel')
    await until(() => evaluate('!document.querySelector(".supplier-modal")'), 'Cancel did not close')
    await clickButton('Add Supplier')
    await evaluate(`document.querySelector('[aria-label="Close supplier form"]').click()`)
    await until(() => evaluate('!document.querySelector(".supplier-modal")'), 'Close button did not close')
    await clickButton('Add Supplier')
    await evaluate(`(() => {const input = document.querySelector('input[required]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Offline supplier'); input.dispatchEvent(new Event('input', {bubbles:true}));})()`)
    await frame()
    await clickButton('Save Supplier')
    await until(() => evaluate('window.__saved === true && !document.querySelector(".supplier-modal")'), 'Successful save did not close')
    console.log('PASS ' + width + 'px: scroll bounds, all fields, last region, selection, product search, validation, focus, close/cancel/save')
  }
} finally {
  socket?.close()
  if (browser && browser.exitCode === null) {
    browser.kill()
    await Promise.race([new Promise(done => browser.once('exit', done)), delay(3000)])
  }
  await server?.close()
  // Delete only the isolated browser profile created above, never a normal user profile.
  const tempRoot = resolve(tmpdir()) + sep
  assert.ok(resolve(profile).startsWith(tempRoot) && dirname(profile) === resolve(tmpdir()) && profile.includes('supplier-modal-check-'))
  await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200})
}
