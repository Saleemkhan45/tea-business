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
    if(path==='/dashboard'||path==='/cash-book'||path==='/login'){
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
  const checks=[];
  for(const width of [320,375,390,430,768,1024,1366])for(const theme of ['light','dark']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=768});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await send('Page.navigate',{url:origin+'/dashboard?hold=1'});
    await until(()=>evaluate("document.querySelectorAll('.stats-grid .kpi-skeleton').length===4"),'Initial KPI skeletons missing');
    await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
    assert.equal(await evaluate("document.querySelector('.loading-spinner-label')?.textContent==='Loading business data...' || [...document.querySelectorAll('.loading-spinner-label')].some(n=>n.textContent==='Loading business data...')"),true);
    assert.equal(await evaluate("[...document.querySelectorAll('.loading-spinner *')].every(n=>getComputedStyle(n).animationName==='none')"),true);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Initial overflow '+width+' '+theme);
    if(width===375 && theme==='dark'){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/dashboard-loading-375.png'),Buffer.from(capture.data,'base64'))}
    await evaluate('window.__releaseDashboard()');
    await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy')) && !document.querySelector('.stats-grid .kpi-skeleton')"),'Confirmed data missing');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Loaded overflow '+width+' '+theme);
    await until(()=>evaluate("document.querySelectorAll('.regional-revenue-values li').length===7"),'Weekly revenue buckets missing');
    await until(()=>evaluate("[...document.querySelectorAll('.regional-revenue .recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(n=>n.textContent).join(',')==='Mon,Tue,Wed,Thu,Fri,Sat,Sun'"),'Weekly axis labels missing');
    assert.ok(await evaluate("document.querySelector('.regional-revenue-total').textContent.includes('PKR 10,000')"));
    if(width===320 && theme==='light'){
      for(const period of ['Daily','Monthly','Weekly']){
        await evaluate("document.querySelector('[aria-label^=\"Revenue period:\"]').click()");
        await evaluate("[...document.querySelectorAll('[role=option]')].find(n=>n.textContent==='"+period+"').click()");
        await until(()=>evaluate("document.querySelectorAll('.regional-revenue-values li').length"+(period==='Daily'?'===1':period==='Weekly'?'===7':'>=28')),'Period buckets missing '+period);
      }
      await evaluate("document.querySelector('.regional-revenue svg[role=application]').scrollIntoView({block:'center'});document.querySelector('.regional-revenue svg[role=application]').focus()");
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await until(()=>evaluate("document.querySelector('.regional-revenue-tooltip')?.textContent.includes('Region: All Regions')"),'Keyboard tooltip missing');
      assert.ok(await evaluate("document.querySelector('.regional-revenue-tooltip').textContent.includes('Sales Revenue: PKR')"));
      const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/regional-revenue-320.png'),Buffer.from(capture.data,'base64'));
    }
    if(width===1366 && theme==='light'){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/dashboard-loaded-1366.png'),Buffer.from(capture.data,'base64'))}
    await evaluate("window.__mode='failure';document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Refresh dashboard data\"]').getAttribute('aria-busy')"),'true');
    assert.equal(await evaluate("document.querySelector('.stats-grid .stat-value').textContent"),'2');
    assert.equal(await evaluate("document.querySelectorAll('.stats-grid .kpi-skeleton').length"),0);
    await until(()=>evaluate("document.querySelector('.dashboard-connection-status.is-interrupted')?.textContent.includes('Previously loaded data')"),'Stale-data notice missing');
    await until(()=>evaluate("!document.querySelector('[aria-label=\"Refresh dashboard data\"]').disabled"),'Refresh loader stuck');
    assert.equal(await evaluate("document.querySelector('.stats-grid .stat-value').textContent"),'2');
    assert.equal(await evaluate("document.body.textContent.includes('Dashboard unavailable')"),false);
    checks.push({width,theme,initialSkeletons:true,tailChase:true,reducedMotion:true,backgroundValuesRetained:true,staleNotice:true,overflow:false});
    console.log('Dashboard loading checks passed at',width,theme);
  }
  await send('Page.navigate',{url:origin+'/dashboard?failure=1'});
  await until(()=>evaluate("document.body.textContent.includes('No confirmed dashboard figures are available')"),'Initial failure missing');
  await until(()=>evaluate("!document.querySelector('.dashboard-connection-status .loading-spinner') && !document.querySelector('.stats-grid .kpi-skeleton')"),'Initial read retries did not stop');
  assert.equal(await evaluate("document.querySelectorAll('.stats-grid .kpi-skeleton').length"),0);
  assert.ok(await evaluate("[...document.querySelectorAll('.stats-grid .stat-value')].every(n=>!/[0-9]/.test(n.textContent))"),'Invented financial zero after error');
  await send('Page.navigate',{url:origin+'/dashboard'});
  await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy'))"),'Fresh session missing');
  await evaluate("window.__mode='unauthorized';document.querySelector('[aria-label=\"Refresh dashboard data\"]').click()");
  await until(()=>evaluate("location.pathname==='/login' && Boolean(document.querySelector('input[autocomplete=\"current-password\"]'))"),'Expired session did not reach login');
  assert.equal(await evaluate("Boolean(document.querySelector('.stats-grid'))"),false);
  await send('Page.navigate',{url:origin+'/dashboard'});
  await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy'))"),'Session restore missing');
  await evaluate("document.querySelector('.admin-trigger').click()");
  await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(n=>n.textContent.includes('Log out')).click()");
  await until(()=>evaluate("location.pathname==='/login'"),'Logout failed');
  assert.equal(await evaluate("Boolean(document.querySelector('.stats-grid'))"),false);
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(resolve(root,'../.tmp/regional-revenue-checks.json'),JSON.stringify({offline:true,checks,initialError:true,noFabricatedZeros:true,expiredSessionRedirect:true,logoutHidesProtectedData:true},null,2));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


