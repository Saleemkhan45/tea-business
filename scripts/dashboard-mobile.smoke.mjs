// Offline geometry/interaction smoke checks. All business responses are test fixtures.
// node client/scripts/dashboard-mobile.smoke.mjs [--baseline]
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = process.argv.includes('--baseline')
const browserPath = process.env.DASHBOARD_TEST_BROWSER ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
assert.ok(browserPath, 'Set DASHBOARD_TEST_BROWSER to a local Chrome/Edge executable.')
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="app"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MainLayout} from '/src/layouts/MainLayout.tsx';
import {DashboardPage} from '/src/pages/DashboardPage.tsx';
import {acceptSession} from '/src/features/auth/auth.store.ts';
import '/src/style.css'; import '/src/audit.css'; import '/src/theme.css';
const e = React.createElement;
window.__requests = []; window.__mode = 'empty'; window.__delay = 0;
const region = {_id:'507f1f77bcf86cd799439002', name:'Offline region with a deliberately long name for layout verification', status:'active'};
window.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), location.origin), path = parsed.pathname;
  if (!path.startsWith('/api/v1/')) throw new Error('External fetch blocked: ' + path);
  if (init.method && init.method !== 'GET') throw new Error('Writes blocked in dashboard smoke test');
  window.__requests.push(path + parsed.search);
  await new Promise(done => setTimeout(done, window.__delay));
  const from = parsed.searchParams.get('from') ?? '2026-10-19', to = parsed.searchParams.get('to') ?? from;
  const reply = (body, status=200) => new Response(JSON.stringify(body), {status});
  if (path.endsWith('/sales/dashboard')) {
    if (window.__mode === 'error') return reply({issues:[{path:'from',message:'Invalid date'}]},400);
    const salesPkr = window.__mode === 'long' ? 123456789 : 0;
    return reply({from,to,regionId:parsed.searchParams.get('regionId'),metrics:{orders:salesPkr?1:0,salesPkr,averageOrderPkr:salesPkr,stockKg:0,creditSalesPkr:0},daily:[{date:from,salesPkr}],categories:[],recentSales:salesPkr?[{_id:'offline-sale',businessDate:from,customerName:'Offline customer',productName:'Offline product with a deliberately long display name',quantityKg:0.125,sellingRegionName:region.name,totalAmount:salesPkr,paymentMethod:'cash',status:'completed'}]:[],khata:{outstandingPkr:0,customers:0,paymentsTodayPkr:0,today:'2026-10-19'}});
  }
  if (path.endsWith('/sales/top-products')) return reply({from,to,regionId:parsed.searchParams.get('regionId'),products:[]});
  if (path.endsWith('/regional/regions')) return reply({regions:[region]});
  if (path.endsWith('/regional/overview')) return reply({regions:[{...region,stockKg:0,lowStockProducts:0,orders:0,quantityKg:0,salesPkr:0}]});
  if (path.endsWith('/report')) return reply({message:'Offline detail unavailable'},503);
  if (path.endsWith('/notifications/unread-count')) return reply({count:0});
  if (path.endsWith('/notifications')) return reply({data:[],pagination:{page:1,totalPages:1,total:0}});
  throw new Error('Unrecognized test request: ' + path);
};
acceptSession({user:{id:'offline',name:'Offline operator',email:'test@example.invalid',role:'admin',shopId:'507f1f77bcf86cd799439001',shopName:'Offline'},csrfToken:'offline',expiresAt:'2099-01-01T00:00:00Z'});
window.__client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:15000}}});
createRoot(document.getElementById('app')).render(e(QueryClientProvider,{client:window.__client},e(MemoryRouter,{initialEntries:['/dashboard']},e(Routes,null,e(Route,{element:e(MainLayout)},e(Route,{path:'/dashboard',element:e(DashboardPage)}),e(Route,{path:'*',element:e('h1',null,'Offline navigation destination')}))))));
</script></body></html>`

const profile = await mkdtemp(join(tmpdir(), 'dashboard-mobile-'))
let server, browser, socket, sequence = 0
const pending = new Map(), results = [], exceptions = []
const delay = ms => new Promise(done => setTimeout(done, ms))
async function until(check, label) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) { const value = await check(); if (value) return value; await delay(100) }
  throw new Error(label)
}
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)) }, 20000)
    pending.set(id, {resolve: value => {clearTimeout(timer); resolve(value)}, reject})
    socket.send(JSON.stringify({id,method,params}))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true})
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const key = async (key, shiftKey = false) => {
  await send('Input.dispatchKeyEvent', {type:'keyDown',key,modifiers:shiftKey ? 8 : 0})
  await send('Input.dispatchKeyEvent', {type:'keyUp',key,modifiers:shiftKey ? 8 : 0})
}
async function tap(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`)
  await delay(250)
  const point = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:${selector === '.scrim' ? 'innerWidth-12' : 'r.x+r.width/2'},y:r.y+r.height/2}})()`)
  const hit = await evaluate(`(() => {const expected=document.querySelector(${JSON.stringify(selector)}),actual=document.elementFromPoint(${point.x},${point.y});return {matches:expected===actual||expected.contains(actual),actual:actual?.outerHTML.slice(0,180),point:${JSON.stringify(point)}}})()`)
  assert.ok(hit.matches,'Touch target is covered: '+selector+' '+JSON.stringify(hit))
  await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point]})
  await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]})
}
try {
  server = await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'offline-dashboard-fixture',configureServer(vite) {
      vite.middlewares.use(async (req,res,next) => {
        if (req.url !== '/__dashboard-mobile.html') return next()
        try {res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,html))} catch(error) {next(error)}
      })
    },
  }]})
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  // A disposable, offline-only profile; no production browser/session is reused.
  browser = spawn(browserPath,['--headless=new','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true})
  browser.on('error',error => console.error(error.message))
  browser.stderr.on('data',data => { if (process.env.DASHBOARD_TEST_DEBUG) process.stderr.write(data) })
  const devtools = await until(async () => {try {return await readFile(join(profile,'DevToolsActivePort'),'utf8')} catch {return null}},'Browser failed to start')
  const targets = await fetch(`http://127.0.0.1:${devtools.split('\n')[0]}/json/list`).then(response => response.json())
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  socket.on('message', async raw => {
    const message = JSON.parse(raw)
    if (process.env.DASHBOARD_TEST_DEBUG && message.id) console.log('CDP reply',message.id,message.error ?? '')
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') {
      const {requestId,request} = message.params
      await send(request.url.startsWith(origin+'/') ? 'Fetch.continueRequest' : 'Fetch.failRequest', request.url.startsWith(origin+'/') ? {requestId} : {requestId,errorReason:'BlockedByClient'})
    }
    const handler = pending.get(message.id)
    if (handler) {pending.delete(message.id);message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result)}
  })
  await new Promise((done,reject) => {socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable'); await send('Runtime.enable')
  await send('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
  for (const [width,height] of [[320,640],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900]]) {
    console.log('Checking viewport',width,height)
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768})
    await send('Page.navigate',{url:origin+'/__dashboard-mobile.html'})
    await until(() => evaluate('Boolean(document.querySelector(".sales-panel"))'),'Dashboard did not load: '+exceptions.join('\n'))
    await delay(500)
    const geometry = await evaluate(`(() => {
      const rect=node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right}};
      return {viewport:${width},height:${height},pageWidth:document.documentElement.scrollWidth,kpiColumns:getComputedStyle(document.querySelector('.stats-grid')).gridTemplateColumns.split(' ').length,kpi:rect(document.querySelector('.stat-card')),menu:rect(document.querySelector('.mobile-menu')),close:rect(document.querySelector('.mobile-close')),chartWidths:[...document.querySelectorAll('.recharts-responsive-container')].map(node=>rect(node).width),requests:[...window.__requests],hiddenNavFocusable:!document.querySelector('.sidebar').inert};
    })()`)
    results.push(geometry)
    if (baseline) continue
    assert.ok(geometry.pageWidth<=width+1,'Page overflow at '+width)
    assert.equal(geometry.kpiColumns,width<=340?1:width<1100?2:4)
    assert.ok(geometry.chartWidths.every(size=>size>0 && size<=width),'Chart overflow at '+width)
    assert.ok(geometry.requests.filter(url=>url.includes('/sales/dashboard?')).length===1,'Duplicate dashboard request')
    if (width===375 || width===1440) {
      const screenshot=await send('Page.captureScreenshot',{format:'png'})
      await writeFile(resolve(root,'../docs',`dashboard-mobile-${width}.png`),Buffer.from(screenshot.data,'base64'))
    }
    if (width<=900) {
      console.log('Checking drawer',width)
      assert.ok(geometry.menu.width>=44 && geometry.menu.height>=44)
      await evaluate('document.querySelector(".mobile-menu").focus()')
      await tap('.mobile-menu')
      await until(() => evaluate('document.querySelector(".sidebar").classList.contains("is-open")'),'Drawer did not open')
      assert.equal(await evaluate('document.body.style.overflow'),'hidden')
      assert.equal(await evaluate('document.querySelector(".main-shell").inert'),true)
      await evaluate('document.querySelector(".sidebar .nav a:last-child").focus()')
      await key('Tab')
      assert.equal(await evaluate('document.querySelector(".sidebar").contains(document.activeElement)'),true)
      await key('Escape')
      await until(() => evaluate('!document.querySelector(".sidebar").classList.contains("is-open")'),'Escape did not close drawer')
      assert.equal(await evaluate('document.activeElement === document.querySelector(".mobile-menu")'),true)
      await tap('.mobile-menu'); await tap('.mobile-close')
      await until(() => evaluate('!document.querySelector(".sidebar").classList.contains("is-open")'),'Close button did not close drawer')
      await tap('.mobile-menu'); await tap('.scrim')
      await until(() => evaluate('!document.querySelector(".sidebar").classList.contains("is-open")'),'Backdrop did not close drawer')
      await tap('.mobile-menu'); await tap('.sidebar a[href="/sales"]')
      await until(() => evaluate('document.querySelector("main h1")?.textContent === "Offline navigation destination"'),'Navigation failed')
      await until(() => evaluate('document.body.style.overflow === ""'),'Navigation did not unlock background scrolling')
      await send('Page.navigate',{url:origin+'/__dashboard-mobile.html'})
      await until(() => evaluate('Boolean(document.querySelector(".sales-panel"))'),'Dashboard reload failed')
    }
    await tap('.date-range-trigger')
    const menu = await evaluate('(() => {const r=document.querySelector(".date-range-popover").getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})()')
    assert.ok(menu.left>=0 && menu.right<=width+1 && menu.bottom<=height+1,'Clipped date menu at '+width)
    await key('Escape')
    if (width===375) {
      await tap('[aria-label^="Dashboard region:"]')
      const regionMenu = await evaluate('(() => {const r=document.querySelector(".select-menu-floating").getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})()')
      assert.ok(regionMenu.left>=0 && regionMenu.right<=width+1 && regionMenu.bottom<=height+1,'Region menu clipped')
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".select-menu-floating")).position'),'fixed','Portal must not rely on another route stylesheet')
      await tap('.select-menu-floating [role="option"]:last-child')
      await until(() => evaluate('window.__requests.some(url=>url.includes("/sales/dashboard?")&&url.includes("regionId="))'),'Region scope did not reach dashboard query')
      assert.equal(await evaluate('window.__requests.some(url=>url.includes("/report?"))'),false,'History was fetched without opening details')
      await tap('.date-range-trigger'); await tap('.date-range-option:nth-child(2)')
      await until(() => evaluate('document.querySelector(".dashboard-scope").textContent.startsWith("Yesterday")'),'Date preset did not apply')
      const before=await evaluate('window.__requests.filter(url=>url.includes("/sales/dashboard?")).length')
      await evaluate('window.__delay=700')
      await tap('[aria-label="Refresh dashboard data"]')
      await tap('[aria-label="Refresh dashboard data"]')
      await until(() => evaluate('!document.querySelector(".dashboard-heading .page-actions > button").disabled'),'Refresh did not complete')
      assert.equal(await evaluate('window.__requests.filter(url=>url.includes("/sales/dashboard?")).length'),before+1,'Simultaneous duplicate refresh')
      await evaluate('window.__delay=0')
      await evaluate('window.__mode="long";void window.__client.invalidateQueries({queryKey:["regional","dashboard"]});undefined')
      await until(() => evaluate('document.querySelector(".stat-card:nth-child(2)").textContent.includes("123,456,789")'),'Full monetary value missing')
      await delay(500)
      assert.equal(await evaluate('[...document.querySelectorAll(".stat-value")].every(node=>node.scrollWidth<=node.clientWidth+1)'),true,'Long KPI value clipped')
      assert.ok(await evaluate('document.documentElement.scrollWidth<=375'),'Recent sales widened the page')
      assert.ok(await evaluate('document.querySelector(".table-responsive").scrollWidth>document.querySelector(".table-responsive").clientWidth'),'Wide recent sales table must scroll locally')
      await tap('.date-range-trigger'); await tap('.date-range-option:nth-child(6)')
      const customMenu=await evaluate('(() => {const r=document.querySelector(".date-range-popover").getBoundingClientRect();return {top:r.top,bottom:r.bottom}})()')
      assert.ok(customMenu.top>=0 && customMenu.bottom<=height+1,'Custom range controls clipped')
      await key('Escape')
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".dashboard-reveal")).transitionDuration'),'0s')
      await send('Emulation.setDeviceMetricsOverride',{width:667,height:375,deviceScaleFactor:1,mobile:true})
      await delay(250)
      assert.ok(await evaluate('document.documentElement.scrollWidth<=667'),'Rotation caused page overflow')
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true})
    }
    console.log('Checking retry',width)
    await evaluate('window.__mode="error";void window.__client.invalidateQueries({queryKey:["regional","dashboard"]});undefined')
    await until(() => evaluate('document.querySelector(".dashboard-page")?.textContent.includes("Dashboard request rejected")'),'API error not shown')
    assert.equal(await evaluate('Boolean(document.querySelector(".top-products-panel"))'),true)
    await evaluate('window.__mode="empty";[...document.querySelectorAll(".state-block button")].find(node=>node.textContent==="Retry").click()')
    await until(() => evaluate('!document.querySelector(".dashboard-page")?.textContent.includes("Dashboard unavailable")'),'Retry did not recover')
  }
  assert.equal(exceptions.length,0,exceptions.join('\n'))
  await writeFile(resolve(root,'../docs',baseline?'dashboard-mobile-baseline.json':'dashboard-mobile-results.json'),JSON.stringify({mode:baseline?'baseline':'after',offline:true,results},null,2))
  console.log(JSON.stringify({mode:baseline?'baseline':'after',viewports:results.length,results},null,2))
} finally {
  if (socket?.readyState===WebSocket.OPEN) {try {await send('Browser.close')} catch {} socket.close()}
  browser?.kill()
  if (server) await Promise.race([server.close(),delay(5000)])
  const resolvedProfile=resolve(profile),temporaryRoot=resolve(tmpdir())+sep
  assert.ok(resolvedProfile.startsWith(temporaryRoot) && dirname(resolvedProfile)===resolve(tmpdir()),'Unsafe temporary profile cleanup')
  await rm(resolvedProfile,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}
