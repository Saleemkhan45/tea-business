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
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MainLayout} from '/src/layouts/MainLayout.tsx'; import {CustomersPage} from '/src/features/customers/pages/CustomersPage.tsx';
import {AppRouter} from '/src/app/router.tsx';
import {acceptSession} from '/src/features/auth/auth.store.ts';
import '/src/style.css'; import '/src/audit.css'; import '/src/theme.css';
window.__count=Number(new URLSearchParams(location.search).get('count')||0); window.__writes=0;
window.fetch=async(url,init={})=>{
 if(init.method && init.method!=='GET'){window.__writes++;throw new Error('Writes forbidden in offline layout check')}
 const path=new URL(String(url),location.origin).pathname;
 if(path==='/api/v1/customers')return new Response(JSON.stringify({customers:Array.from({length:window.__count},(_,i)=>({id:String(i+1).padStart(24,'0'),name:i===0?'Offline customer with a long readable name':'Offline customer '+(i+1),phone:'03001234567',address:'Offline address for horizontal layout testing',status:'active',currentBalancePkr:0})),pagination:{page:1,limit:20,total:window.__count===20?40:window.__count,pages:window.__count===20?2:1}}));
 if(path.endsWith('/notifications/unread-count'))return new Response(JSON.stringify({count:0}));
 if(path.endsWith('/notifications'))return new Response(JSON.stringify({data:[],pagination:{page:1,totalPages:1,total:0}}));
 throw new Error('External request blocked: '+path);
};
acceptSession({user:{id:'offline',name:'Offline operator',email:'test@example.invalid',role:'admin',shopId:'507f1f77bcf86cd799439001',shopName:'Offline'},csrfToken:'offline',expiresAt:'2099-01-01T00:00:00Z'});
const e=React.createElement,legacy=new URLSearchParams(location.search).has('legacy');createRoot(document.getElementById('app')).render(e(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false,staleTime:15000}}})},e(MemoryRouter,{initialEntries:[legacy?'/customers/whatsapp?conversation=old-link':'/customers']},legacy?e(AppRouter):e(Routes,null,e(Route,{element:e(MainLayout)},e(Route,{path:'/customers',element:e(CustomersPage)}))))));
</script></body></html>`
const profile = await mkdtemp(join(tmpdir(), 'customer-layout-'))
let browser, server, socket, sequence = 0
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
async function verifyTogglePlacement(collapsed) {
  const layout = await evaluate(`(() => {
    const button = document.querySelector('.sidebar-toggle');
    const brand = document.querySelector('.brand').getBoundingClientRect();
    const toggle = button.getBoundingClientRect();
    const logo = document.querySelector('.brand-avatar').getBoundingClientRect();
    const copy = document.querySelector('.brand-copy').getBoundingClientRect();
    return {
      singleControl: document.querySelectorAll('.sidebar-toggle').length === 1 && !document.querySelector('.brand-chevron'),
      inBrand: button.parentElement.classList.contains('brand') && toggle.left >= brand.left && toggle.right <= brand.right && toggle.top >= brand.top && toggle.bottom <= brand.bottom,
      aligned: ${collapsed} ? logo.bottom <= toggle.top : copy.right <= toggle.left && Math.abs(toggle.top + toggle.height / 2 - (brand.top + brand.height / 2)) <= 1,
      label: button.getAttribute('aria-label')
    };
  })()`)
  assert.ok(layout.singleControl && layout.inBrand && layout.aligned, JSON.stringify(layout));
  assert.equal(layout.label, collapsed ? 'Expand sidebar' : 'Collapse sidebar');
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
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,local=request.url.startsWith(origin+'/')
      await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'})
    }
    if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result)}
  })
  await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  for(const [width,height] of [[375,812],[768,1024],[1024,768],[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=768});
    await send('Page.navigate',{url:origin+'/__customer-layout.html?count=0'});
    await until(()=>evaluate("Boolean(document.querySelector('.sidebar-toggle'))"),'Layout did not load');
    await evaluate("localStorage.removeItem('tea-business.sidebar-collapsed')");
    await send('Page.reload');await delay(800);
    await until(()=>evaluate("Boolean(document.querySelector('.sidebar-toggle'))"),'Reload failed');
    await delay(300);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.nav-item')].map(link=>[link.getAttribute('aria-label'),link.getAttribute('href')])"),[
      ['Dashboard','/dashboard'],['Sales','/sales'],['Customers','/customers'],['Purchases','/purchases'],['Inventory','/inventory'],['Cash Book','/cash-book'],['Regions','/regions'],['Suppliers','/suppliers'],['Reports','/reports'],['Settings','/settings']
    ]);
    if(width<=900){
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar-toggle')).display"),'none');
      assert.equal(await evaluate("Math.round(document.querySelector('.main-shell').getBoundingClientRect().left)"),0);
      await evaluate("document.querySelector('.mobile-menu').click()");await delay(250);
      assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('is-open')"),true);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-item-label')).display !== 'none'"),true);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await delay(250);
      assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('is-open')"),false);
    }else{
      assert.equal(await evaluate("Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)"),214);
      await verifyTogglePlacement(false);
      await send('Page.bringToFront');await evaluate("document.querySelector('.sidebar-toggle').focus()");
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await delay(300);
      assert.equal(await evaluate("Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)"),72);
      assert.equal(await evaluate("document.querySelector('.sidebar-toggle').getAttribute('aria-expanded')"),'false');
      assert.equal(await evaluate("Math.round(document.querySelector('.main-shell').getBoundingClientRect().left)"),72);
      await verifyTogglePlacement(true);
      await evaluate("document.querySelector('.nav-item').focus()");
      await until(()=>evaluate("document.querySelector('[role=tooltip]')?.textContent==='Dashboard'"),'Focus tooltip missing');
      const rect=await evaluate("(()=>{const r=document.querySelector('.nav-item').getBoundingClientRect();return {x:r.x+20,y:r.y+20}})()");
      await evaluate("document.activeElement.blur()");
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
      await until(()=>evaluate("document.querySelector('[role=tooltip]')?.textContent==='Dashboard'"),'Hover tooltip missing');
      await send('Page.reload');await delay(800);await until(()=>evaluate("Boolean(document.querySelector('.sidebar.is-collapsed'))"),'Preference missing');
      await evaluate("document.querySelector('.sidebar-toggle').click()");await delay(300);
      assert.equal(await evaluate("Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)"),214);
      await verifyTogglePlacement(false);
      assert.ok(await evaluate("Boolean(document.querySelector('.nav-item.active'))"));
    }
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal overflow at '+width);
    console.log('Sidebar checks passed at',width);
  }
  await send('Page.navigate',{url:origin+'/__customer-layout.html?legacy=1'});
  await until(()=>evaluate("document.querySelector('h1')?.textContent === 'Customers'"),'Legacy inbox URL did not redirect to Customers');
  assert.equal(await evaluate("document.body.textContent.includes('WhatsApp Inbox')"),false);
  assert.equal(await evaluate('window.__writes'),0);
  console.log('Legacy inbox redirect and unchanged sidebar routes passed');
  assert.equal(errors.length,0,errors.join('\n'));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


