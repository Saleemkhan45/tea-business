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
const e=React.createElement;createRoot(document.getElementById('app')).render(e(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false,staleTime:15000}}})},e(MemoryRouter,{initialEntries:['/customers']},e(Routes,null,e(Route,{element:e(MainLayout)},e(Route,{path:'/customers',element:e(CustomersPage)}))))));
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
  for(const [width,height] of [[320,640],[375,667],[390,844],[430,932],[768,1024],[1366,768]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768})
    for(const count of [0,1,3,20]){
      await send('Page.navigate',{url:origin+'/__customer-layout.html?count='+count})
      await until(()=>evaluate(`document.querySelectorAll('.customer-directory-table tbody tr').length===${count} && !(document.body?.textContent??'').includes('Loading customers') && Boolean(document.querySelector('.customer-directory-panel'))`),'Directory did not load')
      const geometry=await evaluate(`(()=>{
        const panel=document.querySelector('.customer-directory-panel'),footer=document.querySelector('.customer-directory-footer'),table=document.querySelector('.table-wrap'),page=document.querySelector('.customers-page'),main=document.querySelector('main');
        const measure=node=>{if(!node)return null;const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,minHeight:s.minHeight,cssHeight:s.height,paddingBottom:s.paddingBottom,display:s.display,flex:s.flex,overflowY:s.overflowY,gridRows:s.gridTemplateRows}};
        const tail=footer??panel.lastElementChild;
        return {width:${width},height:${height},count:${count},panel:measure(panel),table:measure(table),footer:measure(footer),page:measure(page),main:measure(main),shell:measure(document.querySelector('.main-shell')),app:measure(document.querySelector('.app-shell')),viewport:{innerWidth,innerHeight,visualWidth:visualViewport.width,visualHeight:visualViewport.height},outliers:[...document.querySelectorAll('.customers-page *')].filter(node=>{const r=node.getBoundingClientRect();return r.right>${width}+1||r.bottom>main.getBoundingClientRect().bottom+30}).map(node=>({tag:node.tagName,className:node.className,position:getComputedStyle(node).position,...measure(node)})).slice(-12),blankAfterContent:panel.getBoundingClientRect().bottom-tail.getBoundingClientRect().bottom,pageWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,tableScrolls:table?table.scrollWidth>table.clientWidth:false,rows:document.querySelectorAll('.customer-directory-table tbody tr').length,writes:window.__writes};
      })()`)
      results.push(geometry)
      if(baseline && width===375 && count===3){
        geometry.probes=await evaluate(`(()=>{
          const result={};for(const [name,css] of Object.entries({panelContainingBlock:'.customers-page .customer-directory-panel{position:relative}',tableContainingBlock:'.customers-page .customer-directory-table{position:relative}',hideOnlyOffscreenHeader:'.customer-directory-table th .sr-only{display:none}'})){
            const style=document.createElement('style');style.textContent=css;document.head.append(style);
            result[name]={width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,innerWidth,innerHeight};style.remove();
          }return result;
        })()`)
      }
      if(!baseline){
        assert.ok(geometry.blankAfterContent>=16 && geometry.blankAfterContent<=25,`Wrong bottom spacing at ${width}/${count}: ${geometry.blankAfterContent}`)
        assert.ok(geometry.pageWidth<=width+1,'Page-wide horizontal overflow')
        assert.ok(geometry.documentHeight<=Math.max(height,Math.ceil(geometry.main.bottom))+1,'Document extends past its actual page content')
        assert.equal(geometry.rows,count)
        assert.equal(geometry.writes,0)
        assert.ok(!['scroll','auto'].includes(geometry.panel.overflowY),'Panel must not add a vertical scrollbar')
        if(count && width<768)assert.ok(geometry.tableScrolls,'Wide table should scroll locally')
        if(count){
          assert.ok(geometry.table.scrollHeight<=geometry.table.clientHeight+1,'Table acquired a nested vertical scrollbar')
          if(width<=720){
            assert.ok(await evaluate('[...document.querySelectorAll(".customer-directory-footer button")].every(node=>node.getBoundingClientRect().height>=44)'),'Pagination targets too short')
          }
          const actionVisible=await evaluate(`(()=>{const wrap=document.querySelector('.table-wrap');wrap.scrollLeft=wrap.scrollWidth;const r=document.querySelector('.customer-open-link').getBoundingClientRect(),w=wrap.getBoundingClientRect();const visible=r.left>=w.left-1&&r.right<=w.right+1;wrap.scrollLeft=0;return visible})()`)
          assert.ok(actionVisible,'Row actions cannot be reached by local horizontal scrolling')
        }
      }
      if(width===375 && count===3){
        await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
        await delay(150)
        const capture=await send('Page.captureScreenshot',{format:'png'})
        await writeFile(resolve(root,`../docs/customer-directory-${baseline?'before':'after'}-375.png`),Buffer.from(capture.data,'base64'))
      }
    }
    console.log('Measured customer directory at',width,height)
  }
  assert.equal(errors.length,0,errors.join('\n'))
  await writeFile(resolve(root,`../docs/customer-directory-${baseline?'baseline':'results'}.json`),JSON.stringify({offline:true,results},(key,value)=>key==='outliers'?undefined:value,2))
  console.log(JSON.stringify(results.filter(row=>row.width===375).map(({count,panel,footer,pageWidth,documentHeight,blankAfterContent,probes})=>({count,panelHeight:panel.height,footerHeight:footer?.height,pageWidth,documentHeight,blankAfterContent,probes})),null,2))
}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}
