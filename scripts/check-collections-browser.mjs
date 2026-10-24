// Offline UI fixtures only. Starts Vite and an isolated headless Edge profile; no API server.
import { createServer } from 'vite'
import WebSocket from 'ws'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, unlink, rm } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createTcpServer } from 'node:net'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = await mkdtemp(join(root, '.collection-browser-'))
const htmlPath = join(scratch, 'check.html')
const errors = []
const results = []
let vite, edge, socket
async function freePort() {
  const server = createTcpServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import {createRoot} from '/node_modules/.vite/deps/react-dom_client.js';
import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';
import {MemoryRouter} from '/node_modules/.vite/deps/react-router-dom.js';
import {CollectionScheduleCard} from '/src/features/collections/CollectionScheduleCard.tsx';
import {CollectionsPanel} from '/src/features/collections/CollectionsPanel.tsx';
import {getPakistanBusinessDate} from '/src/business/utils/date.ts';
import '/src/style.css';import '/src/features/customers/customers.css';
const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
const today=getPakistanBusinessDate();
const params=new URLSearchParams({from:today,to:today,page:'1',limit:'10'});
const customerId='507f1f77bcf86cd799439002';
client.setQueryData(['collections','schedule',customerId],{schedule:null,nextCollectionDate:null});
const count=Number(new URLSearchParams(location.search).get('count')||0);
client.setQueryData(['collections','list',params.toString()],{rows:Array.from({length:count},(_,i)=>({id:'507f1f77bcf86cd79943900'+i,customerId,customerName:'Offline collection fixture '+i,phone:'0300 0000000',balance:19000,scheduledDate:today,expectedAmount:2000,receivedAmount:1000,unpaidAmount:1000,status:'partial'})),total:count,totals:{expected:2000*count,received:1000*count,unpaid:1000*count,collected:0,partial:count,overdue:0}});
createRoot(document.getElementById('app')).render(React.createElement(QueryClientProvider,{client},React.createElement(MemoryRouter,null,React.createElement('main',{style:{maxWidth:1200,margin:'auto',padding:12}},React.createElement(CollectionScheduleCard,{customerId}),React.createElement(CollectionsPanel,{report:true})))));
</script></body></html>`
try {
  await writeFile(htmlPath, page)
  vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.collection-browser-*/**'] } }, logLevel: 'error' })
  await vite.listen()
  console.log('Offline Vite fixture server ready.')
  const vitePort = vite.httpServer.address().port
  const port = await freePort()
  edge = spawn(process.env.EDGE_BINARY || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      `--remote-debugging-port=${port}`, `--user-data-dir=${join(scratch, 'profile')}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' })
  let targets
  for (let attempt = 0; attempt < 100; attempt++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!targets?.length) throw new Error('Headless Edge did not become ready.')
  console.log('Isolated Edge ready.')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject) })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data)
    if (process.env.COLLECTION_BROWSER_DEBUG) console.log('CDP', value.id ?? value.method)
    if (value.id) { const task = pending.get(value.id); pending.delete(value.id); value.error ? task?.reject(new Error(value.error.message)) : task?.resolve(value.result) }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text)
  })
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 15000)
      pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
    return response.result.value
  }
  await command('Runtime.enable')
  await command('Network.enable')
  // Even an accidental API request cannot reach the business backend.
  await command('Network.setBlockedURLs', { urls: ['http://localhost:4000/*', 'http://127.0.0.1:4000/*', 'https://*'] })
  for (const width of [375, 768, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 })
    for (const count of [0, 3, 10]) {
      await command('Page.navigate', { url: `http://127.0.0.1:${vitePort}/${scratch.split(/[\\/]/).at(-1)}/check.html?count=${count}` })
      let ready = false
      for (let attempt = 0; attempt < 100; attempt++) {
        ready = await evaluate(`document.querySelectorAll('input[type=checkbox]').length===7 && document.querySelectorAll('.collection-row').length===${count}`)
        if (ready) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (!ready) throw new Error(`UI fixture failed to render at ${width}px / ${count} rows.`)
      const metrics = await evaluate(`({viewport:innerWidth,width:document.documentElement.scrollWidth,checkboxes:document.querySelectorAll('input[type=checkbox]').length,rows:document.querySelectorAll('.collection-row').length,formColumns:getComputedStyle(document.querySelector('.collection-form')).gridTemplateColumns})`)
      if (metrics.width > metrics.viewport) throw new Error(`Horizontal overflow: ${JSON.stringify(metrics)}`)
      await evaluate(`document.querySelector('input[type=checkbox]').click()`)
      if (!await evaluate(`document.querySelector('input[type=checkbox]').checked`)) throw new Error('Weekday selection failed.')
      results.push({ width, count, ...metrics })
    }
  }
  if (errors.length) throw new Error(`Browser exceptions: ${errors.join(', ')}`)
  console.log(JSON.stringify({ mode: 'offline browser fixtures; no backend', results }, null, 2))
} finally {
  socket?.close()
  if (edge && edge.exitCode === null) {
    edge.kill()
    await new Promise(resolve => { edge.once('exit', resolve); setTimeout(resolve, 3000) })
  }
  await vite?.close()
  // Resolve and verify the test-owned directory before recursive cleanup.
  if (dirname(resolve(scratch)) !== root || !scratch.split(/[\\/]/).at(-1).startsWith('.collection-browser-')) throw new Error('Unsafe browser fixture cleanup path.')
  await unlink(htmlPath).catch(() => {})
  await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => console.error('Browser profile cleanup pending:', scratch))
}
