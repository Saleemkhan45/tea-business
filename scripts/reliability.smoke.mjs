import { installReliabilityFixtures } from './reliability-api.fixture.mjs'
import {installPerformanceFixtures} from './performance-api.fixture.mjs'
// Interactive offline fixtures only; external requests are blocked.
// Production Dashboard with isolated fixtures; CSP blocks external resources and connections.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = process.argv.includes('--baseline')
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
assert.ok(browserPath, 'Chrome/Edge is required for this offline check.')
const dist = resolve(root,baseline ? '../.tmp/performance-baseline-dist' : 'dist')
const html = (await readFile(join(dist,'index.html'),'utf8')).replace('<head>', '<head><script>('+installPerformanceFixtures.toString()+')();('+installReliabilityFixtures.toString()+')()<'+ '/script>')
const profile = await mkdtemp(join(tmpdir(), 'cashbook-flow-'))
let browser, server, socket, sequence = 0, dialogs = 0, acceptDialog = false
const pending = new Map(), results = [], errors = []
const delay = ms => new Promise(done => setTimeout(done, ms))
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {pending.delete(id);reject(new Error('CDP timeout: '+method))}, 20000)
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}})
    socket.send(JSON.stringify({id,method,params}))
  })
}
async function evaluate(expression) {
  const value = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails))
  return value.result.value
}
async function until(check,label) {
  const deadline=Date.now()+20000
  while(Date.now()<deadline){if(await check())return;await delay(100)}
  throw new Error(label+': '+errors.join('\n'))
}
try {
  server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'offline-production-perf',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path.startsWith('/assets/')){
      const name=path.slice('/assets/'.length);assert.match(name,/^[a-zA-Z0-9._-]+$/);
      try{res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'application/javascript');res.end(await readFile(join(dist,'assets',name)))}catch{res.statusCode=404;res.end('Missing fixture asset')}
      return;
    }
    if(path==='/favicon.svg'||path==='/manifest.webmanifest'){res.statusCode=204;res.end();return}
    if(path==='/dashboard'||path==='/cash-book'||path==='/login'||path==='/sales'){
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:");
      res.setHeader('Content-Type','text/html');res.end(html);return
    }
    next()
  })}}]})
  await server.listen()
  const origin='http://127.0.0.1:'+server.httpServer.address().port
  browser=spawn(browserPath,['--headless=new','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true})
  browser.stderr.on('data',()=>{})
  let devtools
  await until(async()=>{try{devtools=await readFile(join(profile,'DevToolsActivePort'),'utf8');return true}catch{return false}},'Browser did not start')
  const targets=await fetch('http://127.0.0.1:'+devtools.split('\n')[0]+'/json/list').then(response=>response.json())
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl)
  socket.on('message',async raw=>{
    const message=JSON.parse(raw),handler=pending.get(message.id)
    if(message.method==='Page.javascriptDialogOpening'){dialogs++;const accept=acceptDialog;acceptDialog=false;await send('Page.handleJavaScriptDialog',{accept})}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)
    if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result)}
  })
  await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.bringToFront');
  const checks = [], timings = {}
  const check = (name, value) => { assert.ok(value, name); checks.push(name) }
  const inspect = expression => evaluate(expression)
  const change = async (selector,value) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await delay(30) }
  await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true})
  await send('Page.navigate',{url:origin+'/dashboard?startup-outage=1'})
  await until(()=>inspect("document.body.textContent.includes('Unable to check session')"),'Truthful startup failure missing')
  check('initial outage exposes no private KPI data',await inspect("!document.querySelector('.stats-grid')"))
  await evaluate('window.__reliability.sessionStatus=200')
  const initialRecovery=Date.now()
  await until(()=>inspect("document.querySelector('.stats-grid .stat-value')?.textContent==='2'"),'Startup did not recover automatically')
  timings.startupRecoveryMs=Date.now()-initialRecovery
  check('startup session checks deduplicated',await inspect("__reliability.attempts.filter(r=>r.path.endsWith('/auth/session')).length===2"))
  check('confirmed Dashboard appears after recovery',await inspect("document.querySelector('.dashboard-connection-status').textContent.includes('Last confirmed')"))
  check('no mobile page overflow',await inspect('document.documentElement.scrollWidth<=innerWidth'))
  await until(()=>inspect("Boolean(document.querySelector('.ranked-product-copy'))"),'Initial product widget missing')
  await evaluate("window.__reliability.offline=true;document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()")
  await until(()=>inspect("document.querySelector('.dashboard-connection-status').textContent.includes('Previously loaded data')"),'Previous-data label missing')
  check('cached values remain visible during network failure',await inspect("document.querySelector('.stats-grid .stat-value').textContent==='2' && !document.querySelector('.stats-grid .kpi-skeleton')"))
  await until(()=>inspect("!document.querySelector('[aria-label=\"Refresh dashboard data\"]').disabled"),'Read retries never stopped')
  check('bounded Dashboard read attempts during outage',await inspect("__reliability.attempts.filter(r=>r.path.endsWith('/sales/dashboard')).length<=4"))
  check('session failure does not unmount Dashboard',await inspect("Boolean(document.querySelector('.dashboard-page'))"))
  await delay(50)
  const stale=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/reliability/dashboard-stale-393.png'),Buffer.from(stale.data,'base64'))
  await evaluate("window.__reliability.offline=false;window.__reliability.salesPkr=16000;document.querySelector('.auth-connection-banner button').click()")
  const recovered=Date.now()
  await until(()=>inspect("document.querySelectorAll('.stats-grid .stat-value')[1]?.textContent.includes('16,000')"),'Failed query did not refetch after session recovery')
  timings.reconnectedKpiMs=Date.now()-recovered
  check('recovered values have a fresh confirmation and no stale label',await inspect("!document.querySelector('.dashboard-connection-status').textContent.includes('Previously loaded data') && !document.querySelector('.auth-connection-banner')"))
  await evaluate("window.__reliability.widgetFailure=true;document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()")
  await until(()=>inspect("!document.querySelector('[aria-label=\"Refresh dashboard data\"]').disabled"),'Widget retries never stopped')
  check('independent product widget failure leaves main KPI values available',await inspect("document.querySelectorAll('.stats-grid .stat-value')[1].textContent.includes('16,000') && !document.body.textContent.includes('Dashboard unavailable')"))
  await send('Page.navigate',{url:origin+'/sales'})
  await until(()=>inspect("Boolean(document.querySelector('.sales-records-page'))"),'Sales page missing')
  await evaluate("document.querySelector('.page-actions .primary-button').click()")
  await until(()=>inspect("Boolean(document.querySelector('.sale-modal textarea'))"),'Add Sale modal missing')
  await evaluate("(()=>{const e=document.querySelector('.sale-modal textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Unsaved offline sale draft');e.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await evaluate("window.__reliability.offline=true;window.dispatchEvent(new Event('online'))")
  await until(()=>inspect("Boolean(document.querySelector('.auth-connection-banner'))"),'Session outage banner missing on Sale')
  check('Sale draft survives failed session check',await inspect("document.querySelector('.sale-modal textarea').value==='Unsaved offline sale draft'"))
  await evaluate("window.__reliability.offline=false;document.querySelector('.auth-connection-banner button').click()")
  await until(()=>inspect("!document.querySelector('.auth-connection-banner')"),'Sale session recovery failed')
  check('Sale draft survives confirmed session recovery',await inspect("document.querySelector('.sale-modal textarea').value==='Unsaved offline sale draft'"))
  acceptDialog=true
  await evaluate("document.querySelector('[aria-label=\"Close add sale modal\"]').click()")
  await until(()=>inspect("!document.querySelector('.sale-modal')"),'Sale cancellation failed')
  check('unsaved Sale close asks for confirmation',dialogs>0)
  check('Sale test sent no financial write',await inspect("__reliability.attempts.every(r=>r.method==='GET')"))
  await send('Page.navigate',{url:origin+'/cash-book'})
  await until(()=>inspect("Boolean(document.querySelector('.manual-entry-form button[type=submit]:not(:disabled)'))"),'Cash entry form not ready')
  await change('.manual-fields label:nth-child(1) input','345')
  await change('.manual-fields label:nth-child(2) input','5')
  await evaluate("window.__reliability.offline=true;document.querySelector('.manual-entry-form button[type=submit]').click();document.querySelector('.manual-entry-form button[type=submit]').click()")
  await until(()=>inspect("document.querySelector('.manual-entry-form button[type=submit]').textContent.includes('Retry Same Request')"),'Uncertain cash request was not frozen for retry')
  check('cash values retained and no false save confirmation',await inspect("document.querySelector('.manual-fields label:nth-child(1) input').value==='345' && document.querySelector('.manual-fields label:nth-child(2) input').value==='5' && __records.length===0 && !document.querySelector('.manual-success')"))
  check('double-click sent one cash request',await inspect("__reliability.attempts.filter(r=>r.method==='POST').length===1"))
  await evaluate("window.__reliability.offline=false;window.__reliability.sessionStatus=503;document.querySelector('.manual-entry-form button[type=submit]').click()")
  await until(()=>inspect("!document.querySelector('.manual-entry-form button[type=submit]').disabled"),'Failed recovery left Cash busy')
  check('cash retry blocked until session validation succeeds',await inspect("__reliability.attempts.filter(r=>r.method==='POST').length===1"))
  await evaluate("window.__reliability.sessionStatus=200;document.querySelector('.manual-entry-form button[type=submit]').click()")
  await until(()=>inspect("Boolean(document.querySelector('.manual-success'))"),'Confirmed cash retry did not succeed')
  check('cash retry uses original idempotency key and acknowledges one saved fixture record',await inspect("(()=>{const writes=__reliability.attempts.filter(r=>r.method==='POST');return writes.length===2 && writes[0].key===writes[1].key && !!writes[0].key && __records.length===1 && __records[0].totalCollected===350})()"))
  await send('Page.navigate',{url:origin+'/dashboard'})
  await until(()=>inspect("document.querySelector('.stats-grid .stat-value')?.textContent==='2'"),'Fresh Dashboard missing')
  await evaluate("window.__reliability.sessionStatus=401;window.dispatchEvent(new Event('online'))")
  await until(()=>inspect("location.pathname==='/login' && Boolean(document.querySelector('input[type=email]'))"),'Genuine session 401 did not sign out')
  check('real 401 hides private cached Dashboard',await inspect("!document.querySelector('.stats-grid')"))
  await send('Page.navigate',{url:origin+'/dashboard'})
  await until(()=>inspect("document.querySelector('.stats-grid .stat-value')?.textContent==='2'"),'Fresh Dashboard after fixture reset missing')
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false})
  const healthy=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/reliability/dashboard-recovered-1366.png'),Buffer.from(healthy.data,'base64'))
  check('no browser exceptions',errors.length===0)
  await writeFile(resolve(root,'../.tmp/reliability/browser-report.json'),JSON.stringify({offline:true,checks,timings},null,2))
  console.log(JSON.stringify({offline:true,passed:checks.length,timings},null,2))

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


