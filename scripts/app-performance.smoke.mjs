import {installPerformanceFixtures} from './performance-api.fixture.mjs'
// Interactive offline fixtures only; external requests are blocked.
// Real CustomersPage/layout/CSS with offline-only directory fixtures; no database access.
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
const html = (await readFile(join(dist,'index.html'),'utf8')).replace('<head>', '<head><script>('+installPerformanceFixtures.toString()+')()<'+ '/script>')
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
    if(path==='/dashboard'||path==='/cash-book'||path==='/login'){res.setHeader('Content-Type','text/html');res.end(html);return}
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
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,local=request.url.startsWith(origin+'/')
      await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'})
    }
    if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result)}
  })
  await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await send('Page.bringToFront');
  await send('Network.enable');
  await send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:512000,uploadThroughput:128000,connectionType:'cellular4g'});
  const samples=[];
  const input=async(selector,value)=>{await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(n,'+JSON.stringify(value)+');n.dispatchEvent(new Event("input",{bubbles:true}))})()');await delay(50)};
  for(let sample=0;sample<3;sample++){
    await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+'/dashboard'});
    await until(()=>evaluate('window.__firstKpi!==null && window.__firstKpi!==undefined'),'No production KPI');
    await until(()=>evaluate("document.querySelector('.ranked-product-copy')?.textContent.includes('Offline Tea')"),'No products');await delay(250);
    const initial=await evaluate('({shellMs:window.__shell,firstKpiMs:window.__firstKpi,requests:[...window.__requests],layoutShift:window.__shifts.reduce((a,b)=>a+b,0),longTasks:[...window.__longTasks],scriptBytes:performance.getEntriesByType("resource").filter(r=>r.name.endsWith(".js")).reduce((n,r)=>n+r.decodedBodySize,0),scriptBytesBeforeKpi:performance.getEntriesByType("resource").filter(r=>r.name.endsWith(".js")&&r.responseEnd<=window.__firstKpi).reduce((n,r)=>n+r.decodedBodySize,0),chartResources:performance.getEntriesByType("resource").filter(r=>/BarChart|AnalyticsBarChart/.test(r.name)).map(r=>({name:r.name,start:r.startTime,end:r.responseEnd}))})');
    assert.ok(initial.firstKpiMs<initial.requests.find(row=>row.path.includes('/sales/top-products')).finishedAt,'KPI waited for unrelated products');
    await evaluate("document.querySelector('.sidebar a[href=\"/cash-book\"]').click()");await until(()=>evaluate("Boolean(document.querySelector('.manual-entry-form button[type=submit]'))"),'Cash form missing');
    await input('.manual-fields input[type=number]','7000');await input('.manual-fields label:nth-child(2) input','3000');
    const saveStart=await evaluate('performance.now()');await evaluate("document.querySelector('.manual-entry-form button[type=submit]').click()");
    if(!baseline){assert.equal(await evaluate("document.querySelector('.manual-entry-form button[aria-busy=true]')!==null"),true)}
    await until(()=>evaluate("document.querySelector('.manual-success')?.textContent.includes('saved')&&document.querySelectorAll('.manual-history tbody tr').length===1"),'No confirmed save/read-back');
    initial.cashSaveThroughReadBackMs=await evaluate('performance.now()')-saveStart;
    initial.cashRequests=await evaluate("window.__requests.filter(r=>r.path.includes('/cashbook/'))");
    const count=await evaluate("window.__requests.filter(r=>r.path.includes('/sales/dashboard')||r.path.includes('/sales/top-products')).length");
    await evaluate("document.querySelector('.sidebar a[href=\"/dashboard\"]').click()");await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy'))"),'Return navigation failed');await delay(100);
    initial.repeatAnalyticsRequests=await evaluate("window.__requests.filter(r=>r.path.includes('/sales/dashboard')||r.path.includes('/sales/top-products')).length")-count;
    const refreshStart=await evaluate('performance.now()');await evaluate("document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()");await until(()=>evaluate("document.body.textContent.includes('Dashboard refreshed.')"),'Refresh failed');
    initial.refreshMs=await evaluate('performance.now()')-refreshStart;
    samples.push(initial);
  }
  await writeFile(resolve(root,'../.tmp/app-performance-'+(baseline?'before':'after')+'.json'),JSON.stringify({offline:true,assetNetwork:{latencyMs:40,downloadBytesPerSecond:512000,uploadBytesPerSecond:128000},syntheticDelaysMs:{dashboard:120,topProducts:500,save:120,history:80,readBack:60},samples},null,2));
  console.log(JSON.stringify({phase:baseline?'before':'after',samples:samples.map(({shellMs,firstKpiMs,cashSaveThroughReadBackMs,repeatAnalyticsRequests,refreshMs,layoutShift,scriptBytes})=>({shellMs,firstKpiMs,cashSaveThroughReadBackMs,repeatAnalyticsRequests,refreshMs,layoutShift,scriptBytes}))},null,2));
  assert.equal(errors.length,0,errors.join('\n'));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


