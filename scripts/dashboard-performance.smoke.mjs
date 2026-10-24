// Interactive offline fixtures only; external requests are blocked.
// Real DashboardPage/layout/CSS with offline-only analytics fixtures; no database access.
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
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module">
import React,{Profiler} from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route,useNavigate} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DashboardPage} from '/src/pages/DashboardPage.tsx';import {MainLayout} from '/src/layouts/MainLayout.tsx';import {AuthProvider} from '/src/features/auth/AuthProvider.tsx';import {acceptSession} from '/src/features/auth/auth.store.ts';import {getPakistanBusinessDate} from '/src/business/utils/date.ts';
import {createAppQueryClient} from '/src/app/queryClient.ts';
import '/src/style.css';import '/src/audit.css';import '/src/theme.css';
window.__requests=[];window.__commits=[];window.__shifts=[];window.__mode='ok';window.__firstKpi=null;window.__shell=null;
const today=getPakistanBusinessDate(),region={_id:'507f1f77bcf86cd799439001',name:'Offline Region',status:'active'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
window.fetch=async(url,init={})=>{
 if(init.method && init.method!=='GET')throw new Error('Writes blocked in dashboard benchmark');
 const u=new URL(String(url),location.origin),start=performance.now();let body;
 if(u.pathname.endsWith('/sales/dashboard')){
  await wait(120);if(window.__mode==='failure'){window.__requests.push({path:u.pathname+u.search,ms:performance.now()-start,status:500});return new Response('{}',{status:500})}
  body={from:u.searchParams.get('from'),to:u.searchParams.get('to'),regionId:u.searchParams.get('regionId'),metrics:{orders:2,salesPkr:10000,averageOrderPkr:5000,stockKg:10,creditSalesPkr:3000},daily:[{date:today,salesPkr:10000}],categories:[{label:'green',orders:2,percent:100}],recentSales:[],khata:{outstandingPkr:3000,customers:1,paymentsTodayPkr:1000,today}};
 }else if(u.pathname.endsWith('/sales/top-products')){await wait(240);body={from:u.searchParams.get('from'),to:u.searchParams.get('to'),regionId:u.searchParams.get('regionId'),products:[{productId:'507f1f77bcf86cd799439002',name:'Offline Tea',quantityKg:2}]}}
 else if(u.pathname.endsWith('/regional/regions')){await wait(80);body={regions:[region]}}
 else if(u.pathname.endsWith('/regional/overview')){await wait(160);body={regions:[{...region,stockKg:10,lowStockProducts:0,orders:2,quantityKg:2,salesPkr:10000}]}}
 else if(u.pathname.endsWith('/cashbook/status')){await wait(100);body={ready:false,mode:'manual_daily',today}}
 else if(u.pathname.endsWith('/collections')){await wait(180);body={rows:[],total:0,totals:{expected:0,received:0,unpaid:0,collected:0,partial:0,overdue:0}}}
 else if(u.pathname.includes('/notifications'))body=u.pathname.endsWith('unread-count')?{count:0}:{data:[],pagination:{page:1,totalPages:1,total:0}};
 else throw new Error('Unexpected or external fixture request '+u.pathname);
 const text=JSON.stringify(body);window.__requests.push({path:u.pathname+u.search,ms:performance.now()-start,bytes:new TextEncoder().encode(text).length,status:200});return new Response(text,{headers:{'Content-Type':'application/json'}});
};
new PerformanceObserver(list=>{for(const row of list.getEntries())if(!row.hadRecentInput)window.__shifts.push(row.value)}).observe({type:'layout-shift',buffered:true});
const mutations=new MutationObserver(()=>{if(window.__shell===null&&document.querySelector('.dashboard-title'))window.__shell=performance.now()-window.__start;if(window.__firstKpi===null&&document.querySelector('.stats-grid .stat-value')?.textContent.includes('2'))window.__firstKpi=performance.now()-window.__start});mutations.observe(document.getElementById('app'),{subtree:true,childList:true,characterData:true});
acceptSession({user:{id:'507f1f77bcf86cd799439003',name:'Offline Owner',email:'test@example.invalid',role:'owner',shopId:'507f1f77bcf86cd799439009',shopName:'Offline'},csrfToken:'offline',expiresAt:'2099-01-01T00:00:00Z'});
const client=createAppQueryClient();window.__client=client;
function Navigation(){window.__navigate=useNavigate();return null}
const e=React.createElement;window.__start=performance.now();createRoot(document.getElementById('app')).render(e(QueryClientProvider,{client},e(AuthProvider,null,e(BrowserRouter,null,e(Navigation),e(Profiler,{id:'dashboard',onRender:(_id,phase,ms)=>window.__commits.push({phase,ms})},e(Routes,null,e(Route,{element:e(MainLayout)},e(Route,{path:'*',element:e(DashboardPage)}),e(Route,{path:'/away',element:e('p',null,'Away')}))))))));
</script></body></html>`
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
  server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'offline-customer-layout',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    if(!req.url.startsWith('/__customer-layout.html'))return next()
    res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__customer-layout.html',html))
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
  const samples=[];
  for(let sample=0;sample<3;sample++){
    await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    const started=Date.now();await send('Page.navigate',{url:origin+'/__customer-layout.html'});
    await until(()=>evaluate('window.__firstKpi!==null && window.__firstKpi!==undefined'),'No confirmed KPI');
    await until(()=>evaluate("document.querySelector('.ranked-product-copy')?.textContent.includes('Offline Tea')"),'No products');await delay(350);
    const initial=await evaluate('({shellMs:window.__shell,firstKpiMs:window.__firstKpi,requests:[...window.__requests],commits:[...window.__commits],layoutShift:window.__shifts.reduce((a,b)=>a+b,0),modules:performance.getEntriesByType("resource").length})');
    initial.navigationToReadyMs=Date.now()-started;
    await evaluate("window.__navigate('/away')");await delay(100);
    const count=await evaluate('window.__requests.length');
    await evaluate("window.__navigate('/__customer-layout.html')");await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy'))"),'Return failed');await delay(350);
    initial.repeatRequests=await evaluate('window.__requests.length')-count;
    const refreshStarted=Date.now();await evaluate("document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()");
    await until(()=>evaluate("document.querySelector('[role=status]')?.textContent.includes('Dashboard refreshed') || document.body.textContent.includes('Dashboard refreshed.')"),'Refresh failed');
    initial.refreshMs=Date.now()-refreshStarted;
    initial.afterRefreshRequests=await evaluate('window.__requests.length');
    samples.push(initial);
  }
  const output=resolve(root,'../.tmp/dashboard-performance-'+(baseline?'before':'after')+'.json');await writeFile(output,JSON.stringify({offline:true,controlledApiDelaysMs:{dashboard:120,topProducts:240,regionalOverview:160,collections:180},samples},null,2));
  console.log(JSON.stringify({output,samples:samples.map(({shellMs,firstKpiMs,repeatRequests,refreshMs,navigationToReadyMs,layoutShift,modules})=>({shellMs,firstKpiMs,repeatRequests,refreshMs,navigationToReadyMs,layoutShift,modules}))},null,2));
  assert.equal(errors.length,0,errors.join('\n'));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


